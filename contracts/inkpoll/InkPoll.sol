// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title InkPoll
 * @notice Paid opinion polling platform for Ink L2.
 *         Projects pay to poll categorized wallet holders.
 *         Users earn soulbound points for responding.
 *
 *         MVP: Polls are shown to all matching wallets via frontend
 *         category matching — no per-wallet record generation needed.
 *         Users respond directly if their categories match.
 */
contract InkPoll is Ownable, ReentrancyGuard {
    // ──────────────────── Types ────────────────────

    enum PollStatus { PENDING, ACTIVE, REJECTED, CLOSED }

    struct UserProfile {
        bool registered;
        uint256 points;
        uint256 streak;
        uint256 lastResponseTime;
        uint32 categoryMask; // bitmask for up to 32 categories
        uint256 registeredAt;
    }

    struct Poll {
        address sender;
        string contentCID;       // R2 object key (api.inksuite.xyz/file/...) for full body
        string[] options;
        uint32 targetCategory;   // category bitmask to match
        uint256 deadline;
        uint256 createdAt;
        PollStatus status;
        uint256 totalResponses;
        uint256 payment;         // USDC amount paid
    }

    // ──────────────────── State ────────────────────

    IERC20 public paymentToken;  // USDC on Ink
    address public treasury;

    // Category names (index → name) for frontend reference
    string[] public categories;

    // Pricing tiers: maxAudience → price
    uint256[] public tierMaxAudience;
    uint256[] public tierPrice;

    // Users
    mapping(address => UserProfile) public users;
    address[] public userList;

    // Polls
    Poll[] public polls;

    // Responses: pollId → user → optionIndex (0 = not responded, actual = index + 1)
    mapping(uint256 => mapping(address => uint8)) public responses;
    // Vote counts: pollId → optionIndex → count
    mapping(uint256 => mapping(uint8 => uint256)) public optionVotes;

    // Verified senders (skip review)
    mapping(address => bool) public verifiedSenders;
    // Approved admins
    mapping(address => bool) public admins;

    // Points config
    uint256 public constant POINTS_REGISTER = 50;
    uint256 public constant POINTS_RESPOND = 10;
    uint256 public constant POINTS_EARLY_BIRD = 15;
    uint256 public constant POINTS_STREAK_BONUS = 20;
    uint256 public constant STREAK_THRESHOLD = 10;

    // ──────────────────── Events ────────────────────

    event UserRegistered(address indexed user, uint32 categoryMask);
    event CategoriesUpdated(address indexed user, uint32 categoryMask);
    event PollSubmitted(uint256 indexed pollId, address indexed sender, uint32 targetCategory, uint256 deadline);
    event PollApproved(uint256 indexed pollId);
    event PollRejected(uint256 indexed pollId);
    event PollResponse(uint256 indexed pollId, address indexed user, uint8 optionIndex);
    event PointsAwarded(address indexed user, uint256 amount, uint256 total);

    // ──────────────────── Modifiers ────────────────────

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "Not admin");
        _;
    }

    // ──────────────────── Constructor ────────────────────

    constructor(address _paymentToken, address _treasury) Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;

        // Default categories
        categories.push("DeFi");           // bit 0
        categories.push("NFTs");           // bit 1
        categories.push("Gaming");         // bit 2
        categories.push("DAOs");           // bit 3
        categories.push("Infrastructure"); // bit 4
        categories.push("Social");         // bit 5
        categories.push("Trading");        // bit 6
        categories.push("Other");          // bit 7

        // Default pricing tiers
        tierMaxAudience.push(500);
        tierPrice.push(5e6);     // 5 USDC (6 decimals)
        tierMaxAudience.push(1000);
        tierPrice.push(10e6);    // 10 USDC
        tierMaxAudience.push(5000);
        tierPrice.push(25e6);    // 25 USDC
        tierMaxAudience.push(10000);
        tierPrice.push(50e6);    // 50 USDC
        tierMaxAudience.push(type(uint256).max);
        tierPrice.push(100e6);   // 100 USDC
    }

    // ──────────────────── User Functions ────────────────────

    function register(uint32 _categoryMask) external {
        require(!users[msg.sender].registered, "Already registered");
        require(_categoryMask > 0, "Select at least one category");

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

    function updateCategories(uint32 _categoryMask) external {
        require(users[msg.sender].registered, "Not registered");
        require(_categoryMask > 0, "Select at least one category");
        users[msg.sender].categoryMask = _categoryMask;
        emit CategoriesUpdated(msg.sender, _categoryMask);
    }

    /// @notice Respond to a poll. User must be registered and categories must match.
    function respond(uint256 _pollId, uint8 _optionIndex) external {
        Poll storage poll = polls[_pollId];
        require(poll.status == PollStatus.ACTIVE, "Poll not active");
        require(block.timestamp <= poll.deadline, "Deadline passed");
        require(users[msg.sender].registered, "Not registered");
        require(users[msg.sender].categoryMask & poll.targetCategory > 0, "Category mismatch");
        require(responses[_pollId][msg.sender] == 0, "Already responded");
        require(_optionIndex < poll.options.length, "Invalid option");

        // Store response (index + 1 so 0 means "not responded")
        responses[_pollId][msg.sender] = _optionIndex + 1;
        poll.totalResponses++;
        optionVotes[_pollId][_optionIndex]++;

        // Calculate points
        UserProfile storage user = users[msg.sender];
        uint256 pointsEarned = POINTS_RESPOND;

        // Early bird: responded before 50% of deadline
        uint256 halfwayPoint = poll.createdAt + (poll.deadline - poll.createdAt) / 2;
        if (block.timestamp <= halfwayPoint) {
            pointsEarned = POINTS_EARLY_BIRD;
        }

        // Streak bonus
        user.streak++;
        if (user.streak % STREAK_THRESHOLD == 0) {
            pointsEarned += POINTS_STREAK_BONUS;
        }
        user.lastResponseTime = block.timestamp;
        user.points += pointsEarned;

        emit PollResponse(_pollId, msg.sender, _optionIndex);
        emit PointsAwarded(msg.sender, pointsEarned, user.points);
    }

    // ──────────────────── Sender Functions ────────────────────

    function getAudienceSize(uint32 _categoryMask) external view returns (uint256 count) {
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
        uint32 _targetCategory
    ) external nonReentrant returns (uint256 pollId) {
        require(_options.length >= 2 && _options.length <= 10, "2-10 options");
        require(_deadline > block.timestamp, "Deadline must be future");
        require(_targetCategory > 0, "Must target a category");

        // Calculate audience and price
        uint256 audience = this.getAudienceSize(_targetCategory);
        require(audience > 0, "No matching audience");
        uint256 price = getPrice(audience);

        // Collect payment
        require(paymentToken.transferFrom(msg.sender, address(this), price), "Payment failed");

        // Create poll
        pollId = polls.length;
        Poll storage poll = polls.push();
        poll.sender = msg.sender;
        poll.contentCID = _contentCID;
        poll.targetCategory = _targetCategory;
        poll.deadline = _deadline;
        poll.createdAt = block.timestamp;
        poll.payment = price;

        // Auto-approve for verified senders
        if (verifiedSenders[msg.sender]) {
            poll.status = PollStatus.ACTIVE;
        } else {
            poll.status = PollStatus.PENDING;
        }

        // Copy options
        for (uint256 i = 0; i < _options.length; i++) {
            poll.options.push(_options[i]);
        }

        emit PollSubmitted(pollId, msg.sender, _targetCategory, _deadline);
        return pollId;
    }

    // ──────────────────── Admin Functions ────────────────────

    function approvePoll(uint256 _pollId) external onlyAdmin {
        Poll storage poll = polls[_pollId];
        require(poll.status == PollStatus.PENDING, "Not pending");
        poll.status = PollStatus.ACTIVE;

        // Move payment to treasury
        paymentToken.transfer(treasury, poll.payment);

        emit PollApproved(_pollId);
    }

    function rejectPoll(uint256 _pollId) external onlyAdmin {
        Poll storage poll = polls[_pollId];
        require(poll.status == PollStatus.PENDING, "Not pending");
        poll.status = PollStatus.REJECTED;

        // Refund sender
        paymentToken.transfer(poll.sender, poll.payment);

        emit PollRejected(_pollId);
    }

    function closePoll(uint256 _pollId) external onlyAdmin {
        Poll storage poll = polls[_pollId];
        require(poll.status == PollStatus.ACTIVE, "Not active");
        poll.status = PollStatus.CLOSED;
    }

    function setPricing(uint256[] calldata _maxAudience, uint256[] calldata _prices) external onlyAdmin {
        require(_maxAudience.length == _prices.length, "Length mismatch");
        delete tierMaxAudience;
        delete tierPrice;
        for (uint256 i = 0; i < _maxAudience.length; i++) {
            tierMaxAudience.push(_maxAudience[i]);
            tierPrice.push(_prices[i]);
        }
    }

    function addCategory(string calldata _name) external onlyAdmin {
        require(categories.length < 32, "Max 32 categories");
        categories.push(_name);
    }

    // ──────────────────── Owner Functions ────────────────────

    function addAdmin(address _admin) external onlyOwner {
        admins[_admin] = true;
    }

    function removeAdmin(address _admin) external onlyOwner {
        admins[_admin] = false;
    }

    function verifySender(address _sender) external onlyAdmin {
        verifiedSenders[_sender] = true;
    }

    function unverifySender(address _sender) external onlyAdmin {
        verifiedSenders[_sender] = false;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function setPaymentToken(address _token) external onlyOwner {
        paymentToken = IERC20(_token);
    }

    // ──────────────────── View Functions ────────────────────

    /// @notice Get all active polls matching a user's categories
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

    /// @notice Get all polls (for admin/sender dashboard)
    function getAllPollIds() external view returns (uint256) {
        return polls.length;
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

    function getRegisteredUsers(uint32 _categoryMask) external view returns (address[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < userList.length; i++) {
            if (users[userList[i]].categoryMask & _categoryMask > 0) count++;
        }
        address[] memory result = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < userList.length; i++) {
            if (users[userList[i]].categoryMask & _categoryMask > 0) {
                result[idx++] = userList[i];
            }
        }
        return result;
    }

    function getTotalUsers() external view returns (uint256) {
        return userList.length;
    }

    function getTotalPolls() external view returns (uint256) {
        return polls.length;
    }

    function getAllCategories() external view returns (string[] memory) {
        return categories;
    }

    function getLeaderboard(uint256 _limit) external view returns (address[] memory, uint256[] memory) {
        uint256 len = userList.length < _limit ? userList.length : _limit;

        address[] memory sorted = new address[](userList.length);
        uint256[] memory pts = new uint256[](userList.length);
        for (uint256 i = 0; i < userList.length; i++) {
            sorted[i] = userList[i];
            pts[i] = users[userList[i]].points;
        }
        // Partial selection sort — top N only (fine for L2 view calls)
        for (uint256 i = 0; i < len; i++) {
            for (uint256 j = i + 1; j < sorted.length; j++) {
                if (pts[j] > pts[i]) {
                    (sorted[i], sorted[j]) = (sorted[j], sorted[i]);
                    (pts[i], pts[j]) = (pts[j], pts[i]);
                }
            }
        }
        address[] memory topAddr = new address[](len);
        uint256[] memory topPts = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            topAddr[i] = sorted[i];
            topPts[i] = pts[i];
        }
        return (topAddr, topPts);
    }
}
