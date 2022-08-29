//SPDX-License-Identifier: Unlicense
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
/**
 * @title HashedTimelock on the evm
 *
 * this contract provides create and save HTLC
 *
 *
 * interface:
 *
 *  1） newHTLC(receiver, hashlock, timelock) - the sender calls this contract to create a new HTLC process.
 *  2） withdraw(htlcId, preimage) - once the receiver knows the preimage of the hash lock,they can withdraw the locked asset.
 *  3） refund() - after the time lock expires,the reciver has not withdrawn the locked asset, the sender can call this to retrieve the locked asset. 
 */
contract HashedTimelock {

    event LogHTLCNew(
        bytes32 indexed htlcId,
        address indexed sender,
        address indexed receiver,
        uint amount,
        bytes32 hashlock,
        uint timelock
    );

    event LogHTLCWithdraw(bytes32 indexed htlcId);

    event LogHTLCRefund(bytes32 indexed htlcId);

    struct LockHTLC {
        address payable sender;
        address payable receiver;
        uint amount;
        bytes32 hashlock; // sha256 hash
        uint timelock; // UNIX timestamp seconds - locked UNTIL this time
        bool withdrawn;
        bool refunded;
        bytes preimage;
        address erc20Address;
        address nftAddress;
    }

    modifier fundsSent() {
        require(msg.value > 0, "msg.value must be > 0");
        _;
    }

    modifier futureTimelock(uint _time) {
        // only requirement is the timelock time is after the last blocktime (now).
        // probably want something a bit further in the future then this.
        // but this is still a useful sanity check:
        require(_time > block.timestamp, "timelock time must be in the future");
        _;
    }

    modifier contractExists(bytes32 _htlcId) {
        require(haveContract(_htlcId), "htlcId does not exist");
        _;
    }

    modifier hashlockMatches(bytes32 _htlcId, bytes memory _x) {
        require(
            contracts[_htlcId].hashlock == sha256(abi.encodePacked(_x)),
            "hashlock hash does not match"
        );
        _;
    }

    modifier withdrawable(bytes32 _htlcId) {
        require(contracts[_htlcId].receiver == msg.sender, "withdrawable: not receiver");
        require(contracts[_htlcId].withdrawn == false, "withdrawable: already withdrawn");
        require(contracts[_htlcId].timelock > block.timestamp, "withdrawable: timelock time must be in the future");
        _;
    }

    modifier refundable(bytes32 _htlcId) {
        require(contracts[_htlcId].sender == msg.sender, "refundable: not sender");
        require(contracts[_htlcId].refunded == false, "refundable: already refunded");
        require(contracts[_htlcId].withdrawn == false, "refundable: already withdrawn");
        require(contracts[_htlcId].timelock <= block.timestamp, "refundable: timelock not yet passed");
        _;
    }


    mapping (bytes32 => LockHTLC) contracts;


    /**
     * @dev Sender create a new HTLC.
     *
     * @param _receiver Receiver address.
     * @param _hashlock Sha256 hash.
     * @param _timelock The expiration date is the timestamp. If the asset has not been extracted by the receiver, it can be retrieved by the sender.
     * @return htlcId The ID of the HTLC where the asset is locked.
     */
    function newHTLC(address payable _receiver, bytes32 _hashlock, uint _timelock)
        external
        payable
        fundsSent
        futureTimelock(_timelock)
        returns (bytes32 htlcId)
    {
        htlcId = sha256(
            abi.encodePacked(
                msg.sender,
                _receiver,
                msg.value,
                _hashlock,
                _timelock
            )
        );
        // Reject if a contract already exists with the same parameters.
        if (haveContract(htlcId))
            revert("Contract already exists");
        address payable sender = payable(msg.sender);
        //create and save
        contracts[htlcId] = LockHTLC(
            sender,
            _receiver,
            msg.value,
            _hashlock,
            _timelock,
            false,
            false,
            '0x0',
            address(0),
            address(0)
        );

        //log
        emit LogHTLCNew(
            htlcId,
            msg.sender,
            _receiver,
            msg.value,
            _hashlock,
            _timelock
        );
    }

    /**
     * @dev Sender create a new HTLC.
     *
     * @param _receiver Receiver address.
     * @param _hashlock Sha256 hash.
     * @param _timelock The expiration date is the timestamp. If the asset has not been extracted by the receiver, it can be retrieved by the sender.
     * @param _token erc20 address
     * @param _amount erc20 amount
     * @return htlcId The ID of the HTLC where the asset is locked.
     */
    function newHTLCERC20(address payable _receiver, bytes32 _hashlock, uint _timelock, address _token, uint _amount)
        external
        futureTimelock(_timelock)
        returns (bytes32 htlcId)
    {
        //save some token to this contract
        IERC20 token = IERC20(address(_token));
        token.transferFrom(msg.sender, address(this), _amount);

        htlcId = sha256(
            abi.encodePacked(
                msg.sender,
                _receiver,
                _amount,
                _hashlock,
                _timelock
            )
        );
        // Reject if a contract already exists with the same parameters.
        if (haveContract(htlcId))
            revert("Contract already exists");
        address payable sender = payable(msg.sender);
        //create and save
        contracts[htlcId] = LockHTLC(
            sender,
            _receiver,
            _amount,
            _hashlock,
            _timelock,
            false,
            false,
            '0x0',
            _token,
            address(0)
        );

        //log
        emit LogHTLCNew(
            htlcId,
            msg.sender,
            _receiver,
            _amount,
            _hashlock,
            _timelock
        );
    }

    /**
     * @dev Sender create a new HTLC.
     *
     * @param _receiver Receiver address.
     * @param _hashlock Sha256 hash.
     * @param _timelock The expiration date is the timestamp. If the asset has not been extracted by the receiver, it can be retrieved by the sender.
     * @param _token nft address
     * @param _amount nft amount
     * @return htlcId The ID of the HTLC where the asset is locked.
     */
    function newHTLCNFT(address payable _receiver, bytes32 _hashlock, uint _timelock, address _token, uint _amount)
        external
        futureTimelock(_timelock)
        returns (bytes32 htlcId)
    {
        htlcId = sha256(
            abi.encodePacked(
                msg.sender,
                _receiver,
                _amount,
                _hashlock,
                _timelock
            )
        );
        // Reject if a contract already exists with the same parameters.
        if (haveContract(htlcId))
            revert("Contract already exists");
        address payable sender = payable(msg.sender);
        //create and save
        contracts[htlcId] = LockHTLC(
            sender,
            _receiver,
            _amount,
            _hashlock,
            _timelock,
            false,
            false,
            '0x0',
            address(0),
            _token
        );

        //log
        emit LogHTLCNew(
            htlcId,
            msg.sender,
            _receiver,
            _amount,
            _hashlock,
            _timelock
        );
    }

    /**
     * @dev Once the receiver knows the original image of the time lock, it will call this method to extract the locked asset
     *
     * @param _htlcId The ID of the HTLC where the asset is locked.
     * @param _preimage sha256(_preimage) equal hashlock.
     * @return bool True on success.
     */
    function withdraw(bytes32 _htlcId, bytes calldata _preimage)
        external
        contractExists(_htlcId)
        hashlockMatches(_htlcId, _preimage)
        withdrawable(_htlcId)
        returns (bool)
    {
        LockHTLC storage c = contracts[_htlcId];
        c.preimage = _preimage;
        c.withdrawn = true;
        c.receiver.transfer(c.amount);
        emit LogHTLCWithdraw(_htlcId);
        return true;
    }

    /**
     * @dev Once the receiver knows the original image of the time lock, it will call this method to extract the locked asset
     *
     * @param _htlcId The ID of the HTLC where the asset is locked.
     * @param _preimage sha256(_preimage) equal hashlock.
     * @param _token erc20 address
     * @return bool True on success.
     */
    function withdrawERC20(bytes32 _htlcId, bytes calldata _preimage, address _token)
        external
        contractExists(_htlcId)
        hashlockMatches(_htlcId, _preimage)
        withdrawable(_htlcId)
        returns (bool)
    {
        LockHTLC storage c = contracts[_htlcId];
        c.preimage = _preimage;
        c.withdrawn = true;
        
        //transfer erc20 to msg.adderss
        IERC20 token = IERC20(address(_token));
        token.transfer(c.receiver, c.amount);
        emit LogHTLCWithdraw(_htlcId);
        return true;
    }


    /**
     * @dev If the time lock expires, the sender calls this method to retrieve the locked asset.
     *
     * @param _htlcId The ID of the HTLC where the asset is locked.
     * @return bool True on success.
     */
    function refund(bytes32 _htlcId)
        external
        contractExists(_htlcId)
        refundable(_htlcId)
        returns (bool)
    {
        LockHTLC storage c = contracts[_htlcId];
        c.refunded = true;
        c.sender.transfer(c.amount);
        emit LogHTLCRefund(_htlcId);
        return true;
    }

    /**
     * @dev If the time lock expires, the sender calls this method to retrieve the locked asset.
     *
     * @param _htlcId The ID of the HTLC where the asset is locked.
     * @param _token erc20 address
     * @return bool True on success.
     */
    function refundERC20(bytes32 _htlcId, address _token)
        external
        contractExists(_htlcId)
        refundable(_htlcId)
        returns (bool)
    {
        LockHTLC storage c = contracts[_htlcId];
        c.refunded = true;
        //transfer erc20 to msg.adderss
        IERC20 token = IERC20(address(_token));
        token.transfer(c.sender, c.amount);
        emit LogHTLCRefund(_htlcId);
        return true;
    }

    /**
     * @dev Get the details of HTLC.
     * @param _htlcId The ID of the HTLC where the asset is locked.
     * @return sender Parameters of all HTLC.
     */
    function getContract(bytes32 _htlcId)
        public
        view
        returns (
            address sender,
            address receiver,
            uint amount,
            bytes32 hashlock,
            uint timelock,
            bool withdrawn,
            bool refunded,
            bytes memory preimage
        )
    {
        if (haveContract(_htlcId) == false){
            bytes memory pi = '0x0';
            return (address(0), address(0), 0, 0, 0, false, false,  pi);
        }
        LockHTLC storage c = contracts[_htlcId];
        return (
            c.sender,
            c.receiver,
            c.amount,
            c.hashlock,
            c.timelock,
            c.withdrawn,
            c.refunded,
            c.preimage
        );
    }

    /**
     * @dev Query whether there is _htlcId of htlcid.
     * @param _htlcId The ID of the HTLC where the asset is locked.
     * @return exists True on exists.
     */
    function haveContract(bytes32 _htlcId)
        internal
        view
        returns (bool exists)
    {
        exists = (contracts[_htlcId].sender != address(0));
    }

}
