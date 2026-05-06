// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title InkPress
 * @author Built by Claude for 2e2c
 * @notice Decentralized publishing on Ink chain. Articles stored off-chain,
 *         mintable as ERC-1155 NFTs by readers. Upgradable via UUPS proxy.
 */
contract InkPress is
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
        string contentId;
        string title;
        string description;
        string coverImageId;
        address author;
        uint256 totalMinted;
        uint256 publishedAt;
        bool active;
        string[] tags;
    }

    // =========================================================================
    //                           STATE VARIABLES
    // =========================================================================
    // UUPS: order and types must match previous versions exactly.
    // New variables go at the end only.

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
    string public storageGatewayUrl;

    uint256 public activeArticleCount;

    uint256 public maxMintSupply;
    mapping(address => uint256) public lastPublishTime;
    uint256 public publishCooldown;

    uint256 public pendingMintPrice;
    uint256 public mintPriceEffectiveTime;
    uint256 public constant ADMIN_CHANGE_DELAY = 24 hours;

    // V3: platform fee + storage gateway timelocks
    uint256 public pendingPlatformFee;
    uint256 public platformFeeEffectiveTime;
    string public pendingStorageGatewayUrl;
    uint256 public storageGatewayUrlEffectiveTime;

    // =========================================================================
    //                              EVENTS
    // =========================================================================

    event ArticlePublished(uint256 indexed articleId, address indexed author, string contentId, string title, string description, string coverImageId, string[] tags);
    event ArticleUnpublished(uint256 indexed articleId);
    event ArticleRepublished(uint256 indexed articleId);
    event ArticleUpdated(uint256 indexed articleId, string contentId);
    event ArticleMinted(uint256 indexed articleId, address indexed minter, uint256 totalMinted);
    event AuthorApproved(address indexed author);
    event AuthorRevoked(address indexed author);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event StorageGatewayUpdated(string oldUrl, string newUrl);
    event BlogMetadataUpdated(string name, string description);
    event AuthorWithdrawal(address indexed author, uint256 amount);
    event PlatformWithdrawal(address indexed to, uint256 amount);
    event UpgradesRenounced();
    event MintPriceAnnounced(uint256 newPrice, uint256 effectiveTime);
    event MaxMintSupplyUpdated(uint256 newMax);
    event PublishCooldownUpdated(uint256 newCooldown);
    event PlatformFeeAnnounced(uint256 newFee, uint256 effectiveTime);
    event StorageGatewayAnnounced(string newUrl, uint256 effectiveTime);

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
    error SupplyCapReached();
    error PublishOnCooldown();
    error PriceChangeTooEarly();
    error PriceChangeNotAnnounced();
    error UnsafeString();
    error FeeChangeTooEarly();
    error FeeChangeNotAnnounced();
    error GatewayChangeTooEarly();
    error GatewayChangeNotAnnounced();

    // =========================================================================
    //                            MODIFIERS
    // =========================================================================

    modifier onlyApprovedAuthor() {
        if (!approvedAuthors[msg.sender] && msg.sender != owner()) {
            revert NotApprovedAuthor();
        }
        _;
    }

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
        string memory _storageGatewayUrl
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
        storageGatewayUrl = _storageGatewayUrl;
        approvedAuthors[_owner] = true;
    }

    // =========================================================================
    //                        AUTHOR FUNCTIONS
    // =========================================================================

    function publishArticle(
        string calldata contentId,
        string calldata title,
        string calldata description,
        string calldata coverImageId,
        string[] calldata tags
    ) external onlyApprovedAuthor whenNotPaused returns (uint256) {
        if (bytes(contentId).length == 0) revert EmptyBlobId();
        if (_containsUnsafeChars(bytes(contentId))) revert UnsafeString();
        if (bytes(coverImageId).length > 0 && _containsUnsafeChars(bytes(coverImageId))) revert UnsafeString();
        if (_containsUnsafeChars(bytes(title)) || _containsUnsafeChars(bytes(description))) revert UnsafeString();
        if (publishCooldown > 0 && block.timestamp < lastPublishTime[msg.sender] + publishCooldown) revert PublishOnCooldown();
        lastPublishTime[msg.sender] = block.timestamp;

        uint256 articleId = nextArticleId++;

        Article storage article = articles[articleId];
        article.contentId = contentId;
        article.title = title;
        article.description = description;
        article.coverImageId = coverImageId;
        article.author = msg.sender;
        article.totalMinted = 0;
        article.publishedAt = block.timestamp;
        article.active = true;

        if (tags.length > 3) revert TooManyTags();
        for (uint256 i = 0; i < tags.length; i++) {
            if (bytes(tags[i]).length > 32) revert TagTooLong();
            article.tags.push(tags[i]);
        }

        activeArticleCount++;

        emit ArticlePublished(articleId, msg.sender, contentId, title, description, coverImageId, tags);
        return articleId;
    }

    function updateArticleContent(
        uint256 articleId,
        string calldata newContentId
    ) external articleExists(articleId) onlyArticleAuthorOrOwner(articleId) whenNotPaused {
        if (bytes(newContentId).length == 0) revert EmptyBlobId();
        if (_containsUnsafeChars(bytes(newContentId))) revert UnsafeString();
        articles[articleId].contentId = newContentId;
        emit ArticleUpdated(articleId, newContentId);
    }

    function unpublishArticle(uint256 articleId)
        external
        articleExists(articleId)
        onlyArticleAuthorOrOwner(articleId)
    {
        Article storage article = articles[articleId];
        if (article.active) {
            article.active = false;
            activeArticleCount--;
            emit ArticleUnpublished(articleId);
        }
    }

    function republishArticle(uint256 articleId)
        external
        articleExists(articleId)
        onlyArticleAuthorOrOwner(articleId)
    {
        Article storage article = articles[articleId];
        if (!article.active) {
            article.active = true;
            activeArticleCount++;
            emit ArticleRepublished(articleId);
        }
    }

    // =========================================================================
    //                        READER FUNCTIONS
    // =========================================================================

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
        if (maxMintSupply > 0 && article.totalMinted >= maxMintSupply) revert SupplyCapReached();

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
            abi.encodePacked(storageGatewayUrl, "/v1/blobs/", article.contentId)
        );

        bytes memory json = abi.encodePacked(
            'data:application/json;utf8,{"name":"', article.title,
            '","description":"', article.description,
            '","external_url":"', contentUrl, '"'
        );

        if (bytes(article.coverImageId).length > 0) {
            json = abi.encodePacked(
                json,
                ',"image":"', storageGatewayUrl, '/v1/blobs/', article.coverImageId, '"'
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

    function revokeAuthor(address author) external onlyOwner {
        approvedAuthors[author] = false;
        emit AuthorRevoked(author);
    }

    // --- Mint price timelock (24h announce-then-apply) ---

    function announceMintPrice(uint256 newPrice) external onlyOwner {
        pendingMintPrice = newPrice;
        mintPriceEffectiveTime = block.timestamp + ADMIN_CHANGE_DELAY;
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

    // --- Platform fee timelock (24h announce-then-apply) ---

    function announcePlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 1000) revert InvalidFee();
        pendingPlatformFee = newFeeBps;
        platformFeeEffectiveTime = block.timestamp + ADMIN_CHANGE_DELAY;
        emit PlatformFeeAnnounced(newFeeBps, platformFeeEffectiveTime);
    }

    function applyPlatformFee() external onlyOwner {
        if (platformFeeEffectiveTime == 0) revert FeeChangeNotAnnounced();
        if (block.timestamp < platformFeeEffectiveTime) revert FeeChangeTooEarly();
        uint256 oldFee = platformFeeBps;
        platformFeeBps = pendingPlatformFee;
        platformFeeEffectiveTime = 0;
        emit PlatformFeeUpdated(oldFee, platformFeeBps);
    }

    // --- Storage gateway timelock (24h announce-then-apply) ---

    function announceStorageGateway(string calldata newUrl) external onlyOwner {
        if (_containsUnsafeChars(bytes(newUrl))) revert UnsafeString();
        pendingStorageGatewayUrl = newUrl;
        storageGatewayUrlEffectiveTime = block.timestamp + ADMIN_CHANGE_DELAY;
        emit StorageGatewayAnnounced(newUrl, storageGatewayUrlEffectiveTime);
    }

    function applyStorageGateway() external onlyOwner {
        if (storageGatewayUrlEffectiveTime == 0) revert GatewayChangeNotAnnounced();
        if (block.timestamp < storageGatewayUrlEffectiveTime) revert GatewayChangeTooEarly();
        string memory oldUrl = storageGatewayUrl;
        storageGatewayUrl = pendingStorageGatewayUrl;
        storageGatewayUrlEffectiveTime = 0;
        emit StorageGatewayUpdated(oldUrl, storageGatewayUrl);
    }

    // --- Instant admin setters (low-risk, safe after multisig) ---

    function setMaxMintSupply(uint256 _max) external onlyOwner {
        maxMintSupply = _max;
        emit MaxMintSupplyUpdated(_max);
    }

    function setPublishCooldown(uint256 _cooldown) external onlyOwner {
        publishCooldown = _cooldown;
        emit PublishCooldownUpdated(_cooldown);
    }

    function setBlogMetadata(
        string calldata _name,
        string calldata _description
    ) external onlyOwner {
        if (_containsUnsafeChars(bytes(_name)) || _containsUnsafeChars(bytes(_description))) revert UnsafeString();
        blogName = _name;
        blogDescription = _description;
        emit BlogMetadataUpdated(_name, _description);
    }

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

    function _authorizeUpgrade(address)
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
