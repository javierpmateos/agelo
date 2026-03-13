export default class Usdt0ProtocolEvm extends BridgeProtocol {
    /**
     * Creates a new read-only interface to the usdt0 protocol for evm blockchains.
     *
     * @overload
     * @param {WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337} account - The wallet account to use to interact with the protocol.
     * @param {BridgeProtocolConfig} [config] - The bridge protocol configuration.
     */
    constructor(account: WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337, config?: BridgeProtocolConfig);
    /**
     * Creates a new interface to the usdt0 protocol for evm blockchains.
     *
     * @overload
     * @param {WalletAccountEvm | WalletAccountEvmErc4337} account - The wallet account to use to interact with the protocol.
     * @param {BridgeProtocolConfig} [config] - The bridge protocol configuration.
     */
    constructor(account: WalletAccountEvm | WalletAccountEvmErc4337, config?: BridgeProtocolConfig);
    /** @private */
    private _chainId;
    /** @private */
    private _provider;
    /**
     * Bridges a token to a different blockchain.
     * 
     * Users must first approve the necessary amount of tokens to the usdt0 protocol using the {@link WalletAccountEvm#approve} or the {@link WalletAccountEvmErc4337#approve} method.
     *
     * @param {BridgeOptions} options - The bridge's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'> & Pick<BridgeProtocolConfig, 'bridgeMaxFee'>} [config] - If the protocol has
     *   been initialized with an erc-4337 wallet account, overrides the 'paymasterToken' option defined in its configuration and the
     *   'bridgeMaxFee' option defined in the protocol configuration.
     * @returns {Promise<BridgeResult>} The bridge's result.
     */
    bridge(options: BridgeOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken"> & Pick<BridgeProtocolConfig, "bridgeMaxFee">): Promise<BridgeResult>;
    /**
     * Quotes the costs of a bridge operation.
     * 
     * Users must first approve the necessary amount of tokens to the usdt0 protocol using the {@link WalletAccountEvm#approve} or the {@link WalletAccountEvmErc4337#approve} method.
     *
     * @param {BridgeOptions} options - The bridge's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337
     *   wallet account, overrides the 'paymasterToken' option defined in its configuration.
     * @returns {Promise<Omit<BridgeResult, 'hash'>>} The bridge's quotes.
     */
    quoteBridge(options: BridgeOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<Omit<BridgeResult, "hash">>;
    /** @private */
    private _getChainId;
    /** @private */
    private _getBridgeTransactions;
    /** @private */
    private _getOftContract;
    /** @private */
    private _getSourceChainConfiguration;
    /** @private */
    private _buildOftSendParam;
    /** @private */
    private _getTransactionValueHelperContract;
}
export type BridgeProtocolConfig = import("@tetherto/wdk-wallet/protocols").BridgeProtocolConfig;
export type BridgeOptions = import("@tetherto/wdk-wallet/protocols").BridgeOptions;
export type WalletAccountReadOnlyEvm = import("@tetherto/wdk-wallet-evm").WalletAccountReadOnlyEvm;
export type EvmErc4337WalletConfig = import("@tetherto/wdk-wallet-evm-erc-4337").EvmErc4337WalletConfig;
export type BridgeResult = {
    /**
     * - The hash of the swap operation.
     */
    hash: string;
    /**
     * - The gas cost.
     */
    fee: bigint;
    /**
     * - The amount of native tokens paid to the bridge protocol.
     */
    bridgeFee: bigint;
    /**
     * - If the protocol has been initialized with a standard wallet account, this field will contain the hash
     * of the approve call to allow usdt0 to transfer the bridged tokens. If the protocol has been initialized with an erc-4337 wallet account,
     * this field will be undefined (since the approve call will be bundled in the user operation with hash {@link BridgeResult#hash}).
     */
    approveHash?: string;
    /**
     * - If the bridge operation has been performed on ethereum mainnet by bridging usdt tokens, this field will
     * contain the hash of the approve call that resets the allowance of the usdt0 protocol to zero (due to the usdt allowance reset requirement).
     * If the protocol has been initialized with an erc-4337 wallet account, this field will be undefined (since the approve call will be bundled in
     * the user operation with hash {@link BridgeResult#hash}).
     */
    resetAllowanceHash?: string;
};
import { BridgeProtocol } from '@tetherto/wdk-wallet/protocols';
import { WalletAccountReadOnlyEvmErc4337 } from '@tetherto/wdk-wallet-evm-erc-4337';
import { WalletAccountEvm } from '@tetherto/wdk-wallet-evm';
import { WalletAccountEvmErc4337 } from '@tetherto/wdk-wallet-evm-erc-4337';
