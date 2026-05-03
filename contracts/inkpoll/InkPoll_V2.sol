// SPDX-License-Identifier: MIT
pragma solidity =0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title  InkPoll V2 — native ETH payments, 8-tier pricing, refund-overpay
contract InkPoll is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    enum PollStatus { PENDING, ACTIVE, REJECTED, CLOSED }

    struct UserProfile {
        bool registered;
        uint256 points;
        uint256 streak;
        uint256 lastResponseTime;
        uint32 categoryMask;
        uint256 registeredAt;
    }

    struct Poll {
        address sender;
        string contentCID;
        string[] options;
        uint32 targetCategory;
        uint256 deadline;
        uint256 createdAt;
        PollStatus status;
        uint256 totalResponses;
        uint256 payment;
    }

    address public treasury;
    string[] public categories;
    uint256[] public tierMaxAudience;
    uint256[] public tierPrice;

    mapping(address => UserProfile) public users;
    address[] public userList;
    Poll[] public polls;

    mapping(uint256 => mapping(address => uint8)) public responses;
    mapping(uint256 => mapping(uint8 => uint256)) public optionVotes;

    mapping(address => bool) public verifiedSenders;
    mapping(address => bool) public admins;

    uint256 public constant POINTS_REGISTER = 50;
    uint256 public constant POINTS_RESPOND = 10;
    uint256 public constant POINTS_EARLY_BIRD = 15;
    uint256 public constant POINTS_STREAK_BONUS = 20;
    uint256 public constant STREAK_THRESHOLD = 10;
    uint32 public constant MAX_CATEGORIES = 32;
    uint256 public constant MAX_USERS = 50000; // P012-PAI-0052: cap users to bound getAudienceSize gas
    uint256 public constant MAX_POLL_DURATION = 90 days; // P012-PAI-0053: cap deadline to prevent sweepETH DoS

    event UserRegistered(address indexed user, uint32 categoryMask);
    event CategoriesUpdated(address indexed user, uint32 categoryMask);
    event PollSubmitted(uint256 indexed pollId, address indexed sender, uint32 targetCategory, uint256 deadline, uint256 payment);
    event PollApproved(uint256 indexed pollId, uint256 payment);
    event PollRejected(uint256 indexed pollId, uint256 refunded);
    event PollClosed(uint256 indexed pollId);
    event PollResponse(uint256 indexed pollId, address indexed user, uint8 optionIndex);
    event PointsAwarded(address indexed user, uint256 amount, uint256 total);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "Not admin");
        _;
    }

    constructor(address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "Zero address");
        treasury = _treasury;

        categories.push("DeFi");
        categories.push("NFTs");
        categories.push("Gaming");
        categories.push("DAOs");
        categories.push("Infrastructure");
        categories.push("Social");
        categories.push("Trading");
        categories.push("Other");

        tierMaxAudience.push(500);                   tierPrice.push(5e15);
        tierMaxAudience.push(1000);                  tierPrice.push(1e16);
        tierMaxAudience.push(2500);                  tierPrice.push(18e15);
        tierMaxAudience.push(5000);                  tierPrice.push(25e15);
        tierMaxAudience.push(10000);                 tierPrice.push(5e16);
        tierMaxAudience.push(25000);                 tierPrice.push(1e17);
        tierMaxAudience.push(50000);                 tierPrice.push(3e17);
        tierMaxAudience.push(type(uint256).max);     tierPrice.push(5e17);
    }

    // ── User Functions ──

    function register(uint32 _categoryMask) external whenNotPaused {
        require(!users[msg.sender].registered, "Already registered");
        require(userList.length < MAX_USERS, "User cap reached"); // P012-PAI-0052
        require(_categoryMask > 0, "Select at least one category");
        require(_validMask(_categoryMask), "Invalid mask");

        users[msg.sender] = UserProfile({
            registered: true,
            points: POINTS_REGISTER,
            streak: 0,
            lastResponseTime: 0,
            categoryMask: _categoryMask,
            registeredAt: block.timestamp
        });
        userList.push(msg.sender);

        emit UserRegistered(msg.sender, _categoryMask);
        emit PointsAwarded(msg.sender, POINTS_REGISTER, POINTS_REGISTER);
    }

    function updateCategories(uint32 _categoryMask) external whenNotPaused {
        require(users[msg.sender].registered, "Not registered");
        require(_categoryMask > 0, "Select at least one category");
        require(_validMask(_categoryMask), "Invalid mask");
        users[msg.sender].categoryMask = _categoryMask;
        emit CategoriesUpdated(msg.sender, _categoryMask);
    }

    function respond(uint256 _pollId, uint8 _optionIndex) external whenNotPaused {
        Poll storage poll = polls[_pollId];
        require(poll.status == PollStatus.ACTIVE, "Poll not active");
        require(block.timestamp <= poll.deadline, "Deadline passed");
        require(users[msg.sender].registered, "Not registered");
        require(users[msg.sender].categoryMask & poll.targetCategory > 0, "Category mismatch");
        require(responses[_pollId][msg.sender] == 0, "Already responded");
        require(_optionIndex < poll.options.length, "Invalid option");
        require(msg.sender != poll.sender, "Cannot respond to own poll");

        responses[_pollId][msg.sender] = _optionIndex + 1;
        poll.totalResponses++;
        optionVotes[_pollId][_optionIndex]++;

        UserProfile storage user = users[msg.sender];
        uint256 pointsEarned = POINTS_RESPOND;

        uint256 halfwayPoint = poll.createdAt + (poll.deadline - poll.createdAt) / 2;
        if (block.timestamp <= halfwayPoint) {
            pointsEarned = POINTS_EARLY_BIRD;
        }

        user.streak++;
        if (user.streak % STREAK_THRESHOLD == 0) {
            pointsEarned += POINTS_STREAK_BONUS;
        }
        user.lastResponseTime = block.timestamp;
        user.points += pointsEarned;

        emit PollResponse(_pollId, msg.sender, _optionIndex);
        emit PointsAwarded(msg.sender, pointsEarned, user.points);
    }

    // ── Sender Functions ──

    // P012-PAI-0052: made public so submitPoll uses internal call (halves gas)
    function getAudienceSize(uint32 _categoryMask) public view returns (uint256 count) {
        for (uint256 i = 0; i < userList.length; i++) {
            if (users[userList[i]].categoryMask & _categoryMask > 0) {
                count++;
            }
        }
    }

    function getPrice(uint256 _audienceSize) public view returns (uint256) {
        for (uint256 i = 0; i < tierMaxAudience.length; i++) {
            if (_audienceSize <= tierMaxAudience[i]) {
                return tierPrice[i];
            }
        }
        return tierPrice[tierPrice.length - 1];
    }

    function submitPoll(
        string calldata _contentCID,
        string[] calldata _options,
        uint256 _deadline,
        uint32 _targetCategory,
        uint256 _claimedAudience
    ) external payable nonReentrant whenNotPaused returns (uint256 pollId) {
        require(_options.length >= 2 && _options.length <= 10, "2-10 options");
        require(_deadline > block.timestamp, "Deadline must be future");
        require(_deadline <= block.timestamp + MAX_POLL_DURATION, "Deadline too far"); // P012-PAI-0053
        require(_targetCategory > 0, "Must target a category");
        require(_validMask(_targetCategory), "Invalid mask");

        uint256 actualAudience = getAudienceSize(_targetCategory); // P012-PAI-0052: internal call
        require(_claimedAudience >= actualAudience, "Audience understated");
        require(_claimedAudience > 0, "No matching audience");
        uint256 price = getPrice(_claimedAudience);

        require(msg.value >= price, "Insufficient payment");

        pollId = polls.length;
        Poll storage poll = polls.push();
        poll.sender = msg.sender;
        poll.contentCID = _contentCID;
        poll.targetCategory = _targetCategory;
        poll.deadline = _deadline;
        poll.createdAt = block.timestamp;
        poll.payment = price;

        if (verifiedSenders[msg.sender]) {
            poll.status = PollStatus.ACTIVE;
            _sendETH(treasury, price);
        } else {
            poll.status = PollStatus.PENDING;
        }

        for (uint256 i = 0; i < _options.length; i++) {
            poll.options.push(_options[i]);
        }

        if (msg.value > price) {
            _sendETH(msg.sender, msg.value - price);
        }

        emit PollSubmitted(pollId, msg.sender, _targetCategory, _deadline, price);
        return pollId;
    }

    // ── Admin Functions ──

    function approvePoll(uint256 _pollId) external onlyAdmin whenNotPaused nonReentrant {
        Poll storage poll = polls[_pollId];
        require(poll.status == PollStatus.PENDING, "Not pending");
        require(block.timestamp < poll.deadline, "Expired");
        poll.status = PollStatus.ACTIVE;
        _sendETH(treasury, poll.payment);
        emit PollApproved(_pollId, poll.payment);
    }

    function rejectPoll(uint256 _pollId) external onlyAdmin nonReentrant {
        Poll storage poll = polls[_pollId];
        require(poll.status == PollStatus.PENDING, "Not pending");
        poll.status = PollStatus.REJECTED;
        _sendETH(poll.sender, poll.payment);
        emit PollRejected(_pollId, poll.payment);
    }

    function closePoll(uint256 _pollId) external nonReentrant {
        Poll storage poll = polls[_pollId];

        if (poll.status == PollStatus.ACTIVE) {
            bool authorized = admins[msg.sender] || msg.sender == owner() ||
                              (msg.sender == poll.sender && block.timestamp >= poll.deadline);
            require(authorized, "Not authorized");
            poll.status = PollStatus.CLOSED;
            emit PollClosed(_pollId);
        } else if (poll.status == PollStatus.PENDING && block.timestamp >= poll.deadline) {
            bool authorized = admins[msg.sender] || msg.sender == owner() || msg.sender == poll.sender;
            require(authorized, "Not authorized");
            poll.status = PollStatus.REJECTED;
            _sendETH(poll.sender, poll.payment);
            emit PollRejected(_pollId, poll.payment);
        } else {
            revert("Invalid state");
        }
    }

    function setPricing(uint256[] calldata _maxAudience, uint256[] calldata _prices) external onlyOwner {
        require(_maxAudience.length > 0 && _maxAudience.length == _prices.length, "Invalid tiers");
        delete tierMaxAudience;
        delete tierPrice;
        for (uint256 i = 0; i < _maxAudience.length; i++) {
            tierMaxAudience.push(_maxAudience[i]);
            tierPrice.push(_prices[i]);
        }
    }

    function addCategory(string calldata _name) external onlyAdmin {
        require(categories.length < MAX_CATEGORIES, "Max 32 categories");
        require(bytes(_name).length > 0 && bytes(_name).length <= 32, "Invalid name");
        categories.push(_name);
    }

    // ── Owner Functions ──

    function addAdmin(address _admin) external onlyOwner {
        require(_admin != address(0), "Zero");
        admins[_admin] = true;
    }

    function removeAdmin(address _admin) external onlyOwner {
        admins[_admin] = false;
    }

    function verifySender(address _sender) external onlyOwner {
        verifiedSenders[_sender] = true;
    }

    function unverifySender(address _sender) external onlyOwner {
        verifiedSenders[_sender] = false;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero");
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function sweepETH(uint256 amount) external onlyOwner nonReentrant {
        for (uint256 i = 0; i < polls.length; i++) {
            require(polls[i].status != PollStatus.PENDING, "Active pending polls");
        }
        _sendETH(owner(), amount);
    }

    function sweepERC20(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ── Internal ──

    function _validMask(uint32 m) internal view returns (bool) {
        uint256 catCount = categories.length;
        if (catCount >= 32) return true;
        return m < (uint32(1) << catCount);
    }

    function _sendETH(address to, uint256 amount) internal {
        (bool success,) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    // ── View Functions ──

    function getActivePolls(address _user) external view returns (uint256[] memory) {
        uint32 userMask = users[_user].categoryMask;
        uint256 count = 0;
        for (uint256 i = 0; i < polls.length; i++) {
            if (polls[i].status == PollStatus.ACTIVE &&
                block.timestamp <= polls[i].deadline &&
                userMask & polls[i].targetCategory > 0) {
                count++;
            }
        }
        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < polls.length; i++) {
            if (polls[i].status == PollStatus.ACTIVE &&
                block.timestamp <= polls[i].deadline &&
                userMask & polls[i].targetCategory > 0) {
                result[idx++] = i;
            }
        }
        return result;
    }

    function getPollOptions(uint256 _pollId) external view returns (string[] memory) {
        return polls[_pollId].options;
    }

    function getPollResults(uint256 _pollId) external view returns (uint256[] memory) {
        uint256 optCount = polls[_pollId].options.length;
        uint256[] memory results = new uint256[](optCount);
        for (uint8 i = 0; i < optCount; i++) {
            results[i] = optionVotes[_pollId][i];
        }
        return results;
    }

    function getTotalUsers() external view returns (uint256) { return userList.length; }
    function getTotalPolls() external view returns (uint256) { return polls.length; }
    function getAllCategories() external view returns (string[] memory) { return categories; }
}
