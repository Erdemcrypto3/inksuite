// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title InkMint
 * @notice AI-generated NFT minting on Ink chain.
 *         Users pay 0.000777 ETH to mint. Image generated off-chain via AI,
 *         stored on Walrus, metadata URI set at mint time.
 */
contract InkMint is ERC721, Ownable {
    using Strings for uint256;

    uint256 public mintPrice = 0.000777 ether;
    uint256 public totalSupply;
    uint256 public maxSupply = 10000;

    // tokenId => metadata URI (walrus blob or IPFS)
    mapping(uint256 => string) private _tokenURIs;

    // tokenId => prompt used to generate
    mapping(uint256 => string) public prompts;

    event Minted(address indexed minter, uint256 indexed tokenId, string prompt, string uri);
    event PriceUpdated(uint256 newPrice);
    event Withdrawn(address indexed to, uint256 amount);

    constructor() ERC721("InkMint", "INKMINT") Ownable(msg.sender) {}

    /**
     * @notice Mint an AI-generated NFT
     * @param uri The metadata URI (Walrus blob ID or full URL)
     * @param prompt The prompt used to generate the image
     */
    function mint(string calldata uri, string calldata prompt) external payable {
        require(msg.value >= mintPrice, "Insufficient payment");
        require(totalSupply < maxSupply, "Max supply reached");
        require(bytes(uri).length > 0, "URI required");

        uint256 tokenId = totalSupply + 1;
        totalSupply = tokenId;

        _safeMint(msg.sender, tokenId);
        _tokenURIs[tokenId] = uri;
        prompts[tokenId] = prompt;

        emit Minted(msg.sender, tokenId, prompt, uri);

        // Refund excess payment
        if (msg.value > mintPrice) {
            (bool ok, ) = payable(msg.sender).call{value: msg.value - mintPrice}("");
            require(ok, "Refund failed");
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId > 0 && tokenId <= totalSupply, "Token does not exist");
        return _tokenURIs[tokenId];
    }

    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
        emit PriceUpdated(newPrice);
    }

    function setMaxSupply(uint256 newMax) external onlyOwner {
        require(newMax >= totalSupply, "Cannot reduce below current supply");
        maxSupply = newMax;
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        (bool ok, ) = payable(owner()).call{value: balance}("");
        require(ok, "Withdraw failed");
        emit Withdrawn(owner(), balance);
    }
}
