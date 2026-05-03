// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title BasePress
 * @author Built by Claude for 2e2c
 * @notice Decentralized blog on Base chain. Articles stored on Walrus (SUI),
 *         mintable as ERC-1155 NFTs by readers. Upgradable via UUPS proxy —
 *         owner can renounce upgrade rights to make it immutable.
 *
 * Features:
 *   - Owner + approved authors can publish articles
 *   - Fixed mint price across all articles (exact payment required)
 *   - Revenue split: author share + platform fee
 *   - Publish / unpublish / republish articles
 *   - Revoked authors lose ALL rights (Mirror.xyz model)
 *   - Pausable for emergency stops
 *   - UUPS upgradable → can be made immutable later
 *
 * Security audit fixes (v2):
 *   - FIX #1: Exact payment required in mintArticle (no overpayment)
 *   - FIX #2: Revoked authors cannot modify their existing articles
 *   - FIX #3: batchMintArticles removed (unnecessary complexity)
 *   - FIX #4: O(1) active article counter instead of O(n) loop
 *   - FIX #5: Zero address validation on approveAuthor
 *   - FIX #6: contractURI returns proper data:application/json URI
 *   - FIX #7: JSON injection prevention in blog metadata + article titles
 *   - FIX #8: uri() returns ERC-1155 compliant metadata JSON
 *   - FIX #9: updateArticleContent blocked during pause
 */
contract BaseBlog is
    Initializable,
    ERC1155Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // =========================================================================
    //                              STRUCTS
    // =========================================================================

    struct Article {
        string walrusBlobId;
        string title;
        string description;
        string coverImageBlobId;
        address author;
        uint256 totalMinted;
        uint256 publishedAt;
        bool active;
        string[] tags;
    }

    // =========================================================================
    //                           STATE VARIABLES
    // =========================================================================

    uint256 public nextArticleId;
    uint256 public mintPrice;
    uint256 public platformFeeBps;
    bool public upgradesRenounced;

    mapping(uint256 => Article) public articles;
    mapping(address => bool) public approvedAuthors;
    uint256 public platformBalance;
    mapping(address => uint256) public authorBalances;

    string public blogName;
    string public blogDescription;
    string public walrusAggregatorUrl;

    /// @notice FIX #4: O(1) counter for active articles
    uint256 public activeArticleCount;

    // P012-PAI-0056: supply cap and publish rate limit
    uint256 public maxMintSupply;
    mapping(address => uint256) public lastPublishTime;
    uint256 public publishCooldown;

    // P012-PAI-0058: price change timelock
    uint256 public pendingMintPrice;
    uint256 public mintPriceEffectiveTime;
    uint256 public constant PRICE_CHANGE_DELAY = 24 hours;

    // =========================================================================
    //                              EVENTS
    // =========================================================================

    event ArticlePublished(uint256 indexed articleId, address indexed author, string walrusBlobId, string title, string description, string coverImageBlobId, string[] tags);
    event ArticleUnpublished(uint256 indexed articleId);
    event ArticleRepublished(uint256 indexed articleId);
    event ArticleUpdated(uint256 indexed articleId, string walrusBlobId);
    event ArticleMinted(uint256 indexed articleId, address indexed minter, uint256 totalMinted);
    event AuthorApproved(address indexed author);
    event AuthorRevoked(address indexed author);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event WalrusAggregatorUpdated(string oldUrl, string newUrl);
    event BlogMetadataUpdated(string name, string description);
    event AuthorWithdrawal(address indexed author, uint256 amount);
    event PlatformWithdrawal(address indexed to, uint256 amount);
    event UpgradesRenounced();
    event MintPriceAnnounced(uint256 newPrice, uint256 effectiveTime); // P012-PAI-0058
    event MaxMintSupplyUpdated(uint256 newMax); // P012-PAI-0056
    event PublishCooldownUpdated(uint256 newCooldown); // P012-PAI-0056

    // =========================================================================
    //                              ERRORS
    // =========================================================================

    error NotApprovedAuthor();
    error ArticleDoesNotExist();
    error ArticleNotActive();
    error IncorrectPayment();
    error NoBalanceToWithdraw();
    error TransferFailed();
    error UpgradesPermanentlyRenounced();
    error InvalidFee();
    error EmptyBlobId();
    error InvalidAddress();
    error TooManyTags();
    error TagTooLong();
    error SupplyCapReached(); // P012-PAI-0056
    error PublishOnCooldown(); // P012-PAI-0056
    error PriceChangeTooEarly(); // P012-PAI-0058
    error PriceChangeNotAnnounced(); // P012-PAI-0058

    // =========================================================================
    //                            MODIFIERS
    // =========================================================================

    modifier onlyApprovedAuthor() {
        if (!approvedAuthors[msg.sender] && msg.sender != owner()) {
            revert NotApprovedAuthor();
        }
        _;
    }

    /// @notice FIX #2: Author must be currently approved OR be the owner.
    ///         Revoked authors lose all access to their articles.
    modifier onlyArticleAuthorOrOwner(uint256 articleId) {
        Article storage article = articles[articleId];
        bool isOwner = msg.sender == owner();
        bool isActiveAuthor = (msg.sender == article.author) && approvedAuthors[msg.sender];
        if (!isOwner && !isActiveAuthor) {
            revert NotApprovedAuthor();
        }
        _;
    }

    modifier articleExists(uint256 articleId) {
        if (articleId >= nextArticleId) {
            revert ArticleDoesNotExist();
        }
        _;
    }

    // =========================================================================
    //                           INITIALIZER
    // =========================================================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        string memory _blogName,
        string memory _blogDescription,
        uint256 _mintPrice,
        uint256 _platformFeeBps,
        string memory _walrusAggregatorUrl
    ) public initializer {
        if (_platformFeeBps > 1000) revert InvalidFee();
        if (_containsUnsafeChars(bytes(_blogName)) || _containsUnsafeChars(bytes(_blogDescription))) revert UnsafeString();

        __ERC1155_init("");
        __Ownable_init(_owner);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        blogName = _blogName;
        blogDescription = _blogDescription;
        mintPrice = _mintPrice;
        platformFeeBps = _platformFeeBps;
        walrusAggregatorUrl = _walrusAggregatorUrl;
        approvedAuthors[_owner] = true;
    }

    // =========================================================================
    //                        AUTHOR FUNCTIONS
    // =========================================================================

    function publishArticle(
        string calldata walrusBlobId,
        string calldata title,
        string calldata description,
        string calldata coverImageBlobId,
        string[] calldata tags
    ) external onlyApprovedAuthor whenNotPaused returns (uint256) {
        if (bytes(walrusBlobId).length == 0) revert EmptyBlobId();
        if (_containsUnsafeChars(bytes(title)) || _containsUnsafeChars(bytes(description))) revert UnsafeString();
        // P012-PAI-0056: publish rate limit
        if (publishCooldown > 0 && block.timestamp < lastPublishTime[msg.sender] + publishCooldown) revert PublishOnCooldown();
        lastPublishTime[msg.sender] = block.timestamp;

        uint256 articleId = nextArticleId++;

        Article storage article = articles[articleId];
        article.walrusBlobId = walrusBlobId;
        article.title = title;
        article.description = description;
        article.coverImageBlobId = coverImageBlobId;
        article.author = msg.sender;
        article.totalMinted = 0;
        article.publishedAt = block.timestamp;
        article.active = true;

        if (tags.length > 3) revert TooManyTags();
        for (uint256 i = 0; i < tags.length; i++) {
            if (bytes(tags[i]).length > 32) revert TagTooLong();
            article.tags.push(tags[i]);
        }

        activeArticleCount++;  // FIX #4

        emit ArticlePublished(articleId, msg.sender, walrusBlobId, title, description, coverImageBlobId, tags);
        return articleId;
    }

    /// @notice FIX #2: Revoked authors cannot update their articles
    /// @dev Also paused during emergency — content should not change
    function updateArticleContent(
        uint256 articleId,
        string calldata newWalrusBlobId
    ) external articleExists(articleId) onlyArticleAuthorOrOwner(articleId) whenNotPaused {
        if (bytes(newWalrusBlobId).length == 0) revert EmptyBlobId();
        articles[articleId].walrusBlobId = newWalrusBlobId;
        emit ArticleUpdated(articleId, newWalrusBlobId);
    }

    /// @notice FIX #2: Revoked authors cannot unpublish their articles
    function unpublishArticle(uint256 articleId)
        external
        articleExists(articleId)
        onlyArticleAuthorOrOwner(articleId)
    {
        Article storage article = articles[articleId];
        if (article.active) {
            article.active = false;
            activeArticleCount--;  // FIX #4
            emit ArticleUnpublished(articleId);
        }
    }

    /// @notice FIX #2: Revoked authors cannot republish their articles
    function republishArticle(uint256 articleId)
        external
        articleExists(articleId)
        onlyArticleAuthorOrOwner(articleId)
    {
        Article storage article = articles[articleId];
        if (!article.active) {
            article.active = true;
            activeArticleCount++;  // FIX #4
            emit ArticleRepublished(articleId);
        }
    }

    // =========================================================================
    //                        READER FUNCTIONS
    // =========================================================================

    /// @notice FIX #1: Requires exact payment — no overpayment accepted
    function mintArticle(uint256 articleId)
        external
        payable
        articleExists(articleId)
        whenNotPaused
        nonReentrant
    {
        Article storage article = articles[articleId];
        if (!article.active) revert ArticleNotActive();
        if (msg.value != mintPrice) revert IncorrectPayment();
        if (maxMintSupply > 0 && article.totalMinted >= maxMintSupply) revert SupplyCapReached(); // P012-PAI-0056

        _mint(msg.sender, articleId, 1, "");
        article.totalMinted++;

        if (msg.value > 0) {
            uint256 platformCut = (msg.value * platformFeeBps) / 10000;
            uint256 authorCut = msg.value - platformCut;
            platformBalance += platformCut;
            authorBalances[article.author] += authorCut;
        }

        emit ArticleMinted(articleId, msg.sender, article.totalMinted);
    }

    // =========================================================================
    //                       WITHDRAWAL FUNCTIONS
    // =========================================================================

    function withdrawAuthorBalance() external nonReentrant {
        uint256 balance = authorBalances[msg.sender];
        if (balance == 0) revert NoBalanceToWithdraw();

        authorBalances[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: balance}("");
        if (!success) revert TransferFailed();

        emit AuthorWithdrawal(msg.sender, balance);
    }

    function withdrawPlatformBalance() external onlyOwner nonReentrant {
        uint256 balance = platformBalance;
        if (balance == 0) revert NoBalanceToWithdraw();

        platformBalance = 0;

        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert TransferFailed();

        emit PlatformWithdrawal(owner(), balance);
    }

    // =========================================================================
    //                         VIEW FUNCTIONS
    // =========================================================================

    function getArticle(uint256 articleId)
        external
        view
        articleExists(articleId)
        returns (Article memory)
    {
        return articles[articleId];
    }

    function getArticles(uint256 offset, uint256 limit)
        external
        view
        returns (Article[] memory result, uint256 total)
    {
        total = nextArticleId;
        if (offset >= total) {
            return (new Article[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;

        result = new Article[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = articles[offset + i];
        }
    }

    /// @notice FIX #4: O(1) — reads the counter directly
    function getActiveArticleCount() external view returns (uint256) {
        return activeArticleCount;
    }

    function hasMinted(address account, uint256 articleId)
        external
        view
        returns (bool)
    {
        return balanceOf(account, articleId) > 0;
    }

    function uri(uint256 articleId)
        public
        view
        override
        articleExists(articleId)
        returns (string memory)
    {
        Article memory article = articles[articleId];
        string memory contentUrl = string(
            abi.encodePacked(walrusAggregatorUrl, "/v1/blobs/", article.walrusBlobId)
        );

        // Build ERC-1155 compliant metadata JSON
        bytes memory json = abi.encodePacked(
            'data:application/json;utf8,{"name":"', article.title,
            '","description":"', article.description,
            '","external_url":"', contentUrl, '"'
        );

        // Add image if cover exists
        if (bytes(article.coverImageBlobId).length > 0) {
            json = abi.encodePacked(
                json,
                ',"image":"', walrusAggregatorUrl, '/v1/blobs/', article.coverImageBlobId, '"'
            );
        }

        return string(abi.encodePacked(json, '}'));
    }

    // =========================================================================
    //                         ADMIN FUNCTIONS
    // =========================================================================

    function approveAuthor(address author) external onlyOwner {
        if (author == address(0)) revert InvalidAddress();
        approvedAuthors[author] = true;
        emit AuthorApproved(author);
    }

    /// @notice FIX #2: Revoked author loses ALL rights — cannot manage existing articles
    function revokeAuthor(address author) external onlyOwner {
        approvedAuthors[author] = false;
        emit AuthorRevoked(author);
    }

    // P012-PAI-0058: price changes require 24h announce-then-apply
    function announceMintPrice(uint256 newPrice) external onlyOwner {
        pendingMintPrice = newPrice;
        mintPriceEffectiveTime = block.timestamp + PRICE_CHANGE_DELAY;
        emit MintPriceAnnounced(newPrice, mintPriceEffectiveTime);
    }

    function applyMintPrice() external onlyOwner {
        if (mintPriceEffectiveTime == 0) revert PriceChangeNotAnnounced();
        if (block.timestamp < mintPriceEffectiveTime) revert PriceChangeTooEarly();
        uint256 oldPrice = mintPrice;
        mintPrice = pendingMintPrice;
        mintPriceEffectiveTime = 0;
        emit MintPriceUpdated(oldPrice, mintPrice);
    }

    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 1000) revert InvalidFee();
        uint256 oldFee = platformFeeBps;
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(oldFee, newFeeBps);
    }

    // P012-PAI-0056: supply cap and publish cooldown setters
    function setMaxMintSupply(uint256 _max) external onlyOwner {
        maxMintSupply = _max;
        emit MaxMintSupplyUpdated(_max);
    }

    function setPublishCooldown(uint256 _cooldown) external onlyOwner {
        publishCooldown = _cooldown;
        emit PublishCooldownUpdated(_cooldown);
    }

    function setWalrusAggregatorUrl(string calldata newUrl) external onlyOwner {
        string memory oldUrl = walrusAggregatorUrl;
        walrusAggregatorUrl = newUrl;
        emit WalrusAggregatorUpdated(oldUrl, newUrl);
    }

    error UnsafeString();

    function setBlogMetadata(
        string calldata _name,
        string calldata _description
    ) external onlyOwner {
        if (_containsUnsafeChars(bytes(_name)) || _containsUnsafeChars(bytes(_description))) revert UnsafeString();
        blogName = _name;
        blogDescription = _description;
        emit BlogMetadataUpdated(_name, _description);
    }

    /// @dev Rejects strings containing characters that would break JSON: " and \ and control chars
    function _containsUnsafeChars(bytes memory b) internal pure returns (bool) {
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (c == 0x22 || c == 0x5C || uint8(c) < 0x20) return true;
        }
        return false;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function renounceUpgrades() external onlyOwner {
        upgradesRenounced = true;
        emit UpgradesRenounced();
    }

    // =========================================================================
    //                         UUPS OVERRIDE
    // =========================================================================

    function _authorizeUpgrade(address /*newImplementation*/)
        internal
        override
        onlyOwner
    {
        if (upgradesRenounced) revert UpgradesPermanentlyRenounced();
    }

    // =========================================================================
    //                      ERC-1155 OVERRIDES
    // =========================================================================

    function contractURI() public view returns (string memory) {
        return string(
            abi.encodePacked(
                'data:application/json;utf8,{"name":"', blogName,
                '","description":"', blogDescription, '"}'
            )
        );
    }
}
