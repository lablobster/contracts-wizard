<script lang="ts">
  import type {
      Contract,
      Kind,
      KindedOptions,
      OptionsErrorMessages,
  } from "@openzeppelin/wizard";
  import {
      ContractBuilder,
      OptionsError,
      buildGeneric,
      printContract,
      sanitizeKind,
  } from "@openzeppelin/wizard";
  import { createWeb3Modal, defaultWagmiConfig } from "@web3modal/wagmi";
  import { saveAs } from "file-saver";
  import { createEventDispatcher } from "svelte";
  import CustomControls from "./CustomControls.svelte";
  import Dropdown from "./Dropdown.svelte";
  import ERC1155Controls from "./ERC1155Controls.svelte";
  import ERC20Controls from "./ERC20Controls.svelte";
  import ERC721Controls from "./ERC721Controls.svelte";
  import GovernorControls from "./GovernorControls.svelte";
  import OverflowMenu from "./OverflowMenu.svelte";
  import Tooltip from "./Tooltip.svelte";
  import hljs from "./highlightjs";
  import CheckIcon from "./icons/CheckIcon.svelte";
  import CopyIcon from "./icons/CopyIcon.svelte";
  import DownloadIcon from "./icons/DownloadIcon.svelte";
  import FileIcon from "./icons/FileIcon.svelte";
  import RemixIcon from "./icons/RemixIcon.svelte";
  import ZipIcon from "./icons/ZipIcon.svelte";
  import { postConfig } from "./post-config";
  import { remixURL } from "./remix";
  import { injectHyperlinks } from "./utils/inject-hyperlinks";

  import { reconnect } from "@wagmi/core";
  import { ethers } from "ethers";
  import { rollux } from "viem/chains";

  const dispatch = createEventDispatcher();
  export let initialTab: string | undefined = "ERC20";
  export let tab: Kind = sanitizeKind(initialTab);
  $: {
    tab = sanitizeKind(tab);
    dispatch("tab-change", tab);
  }
  let allOpts: { [k in Kind]?: Required<KindedOptions[k]> } = {};
  let errors: { [k in Kind]?: OptionsErrorMessages } = {};
  let contract: Contract = new ContractBuilder("MyToken");
  $: functionCall && applyFunctionCall();
  $: opts = allOpts[tab];
  $: {
    if (opts) {
      try {
        const newContract = buildGeneric(opts);
        if (contract !== newContract) {
          contract = newContract;
          compiled = false; // Resetar 'compiled' quando o contrato for alterado
        }
        errors[tab] = undefined;
      } catch (e: unknown) {
        if (e instanceof OptionsError) {
          errors[tab] = e.messages;
        } else {
          throw e;
        }
      }
    }
  }
  $: code = printContract(contract);
  $: highlightedCode = injectHyperlinks(hljs.highlight("solidity", code).value);

  const language = "solidity";
  let copied = false;
  let compiled = false;
  let compiling = false;

  const copyHandler = async () => {
    await navigator.clipboard.writeText(code);
    copied = true;
    if (opts) {
      await postConfig(opts, "copy", language);
    }
    setTimeout(() => {
      copied = false;
    }, 1000);
  };

  let compiledBytecode: string | undefined;
  let compiledAbi: any[] | undefined;

  const compileHandler = async () => {
    try {
      compiling = true;
      const response = await fetch("https://api.metio.lat/compile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      if (response.ok) {
        const compiledContract = await response.json();
        console.log("Compilation successful", compiledContract);

        // Save the bytecode and ABI in variables
        compiledBytecode = compiledContract.evm.bytecode.object;
        compiledAbi = compiledContract.abi;
        compiled = true;
        compiling = false;
      } else {
        const errors = await response.json();
        console.error("Compilation errors:", errors.errors);
        compiling = false;
      }
    } catch (err) {
      console.error("Compilation error:", err);
      compiling = false;
    }
  };

  let deploying = false;

  const handleDeploy = async () => {
    try {
      if (!compiledBytecode || !compiledAbi) {
        console.error("Contract is not compiled yet.");
        return;
      }

      if (!window.ethereum) {
        console.error("No Ethereum provider found. Install MetaMask.");
        return;
      }

      deploying = true;

      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const gasLimit = 3000000;

      const factory = new ethers.ContractFactory(
        compiledAbi,
        compiledBytecode,
        signer
      );
      const contract = await factory.deploy({ gasLimit });
      await contract.waitForDeployment();

      deploying = false;
    } catch (error) {
      console.error("Deployment error:", error);
      deploying = false;
    }
  };

  const remixHandler = async (e: MouseEvent) => {
    e.preventDefault();
    if ((e.target as Element)?.classList.contains("disabled")) return;
    const { printContractVersioned } = await import(
      "@openzeppelin/wizard/print-versioned"
    );
    const versionedCode = printContractVersioned(contract);
    window.open(
      remixURL(versionedCode, !!opts?.upgradeable).toString(),
      "_blank",
      "noopener,noreferrer"
    );
    if (opts) {
      await postConfig(opts, "remix", language);
    }
  };

  const downloadNpmHandler = async () => {
    const blob = new Blob([code], { type: "text/plain" });
    if (opts) {
      saveAs(blob, opts.name + ".sol");
      await postConfig(opts, "download-npm", language);
    }
  };

  const zipHardhatModule = import("@openzeppelin/wizard/zip-env-hardhat");
  const downloadHardhatHandler = async () => {
    const { zipHardhat } = await zipHardhatModule;
    const zip = await zipHardhat(contract, opts);
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "project.zip");
    if (opts) {
      await postConfig(opts, "download-hardhat", language);
    }
  };

  const zipFoundryModule = import("@openzeppelin/wizard/zip-env-foundry");
  const downloadFoundryHandler = async () => {
    const { zipFoundry } = await zipFoundryModule;
    const zip = await zipFoundry(contract, opts);
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "project.zip");
    if (opts) {
      await postConfig(opts, "download-foundry", language);
    }
  };

  const nameMap = {
    erc20: "ERC20",
    erc721: "ERC721",
    erc1155: "ERC1155",
    governor: "Governor",
    custom: "Custom",
  };

  let functionCall: {
    name?: string;
    opts?: any;
  } = {};
  const applyFunctionCall = () => {
    if (functionCall.name) {
      const name = functionCall.name as keyof typeof nameMap;
      tab = sanitizeKind(nameMap[name]);
      allOpts[tab] = {
        ...allOpts[tab],
        ...functionCall.opts,
      };
    }
  };

  // TODO: change this project ID to new project with connectwallet
  const projectId = "2053d40d3bf13ea57900bec9780661ee";
  const metadata = {
    name: "Web3Modal",
    description: "Web3Modal Example",
    url: "https://web3modal.com", // origin must match your domain & subdomain
    icons: ["https://avatars.githubusercontent.com/u/37784886"],
  };

  const chains = [rollux] as const;
  const config = defaultWagmiConfig({
    chains,
    projectId,
    metadata,
  });

  reconnect(config);

  createWeb3Modal({ wagmiConfig: config, projectId });
</script>

<div class="container flex flex-col gap-4 p-4">
  <div class="header flex flex-row justify-between">
    <div class="tab overflow-hidden">
      <OverflowMenu>
        <button
          class:selected={tab === "ERC20"}
          on:click={() => (tab = "ERC20")}
        >
          ERC20
        </button>
        <button
          class:selected={tab === "ERC721"}
          on:click={() => (tab = "ERC721")}
        >
          ERC721
        </button>
        <button
          class:selected={tab === "ERC1155"}
          on:click={() => (tab = "ERC1155")}
        >
          ERC1155
        </button>
        <button
          class:selected={tab === "Governor"}
          on:click={() => (tab = "Governor")}
        >
          Governor
        </button>
        <button
          class:selected={tab === "Custom"}
          on:click={() => (tab = "Custom")}
        >
          Custom
        </button>
      </OverflowMenu>
    </div>
    <div class="action flex flex-row gap-2 shrink-0">
      <w3m-button balance={"hide"} loadingLabel={"Loading ..."} />
      <button
        class="action-button min-w-[165px]"
        on:click={compiled ? handleDeploy : compileHandler}
        disabled={compiling || deploying}
      >
        {#if compiling}
          Compiling...
        {:else if compiled}
          {#if deploying}
            Deploying...
          {:else}
            Deploy
          {/if}
        {:else}
          Compile
        {/if}
      </button>
      <button class="action-button min-w-[165px]" on:click={copyHandler}>
        {#if copied}
          <CheckIcon />
          Copied
        {:else}
          <CopyIcon />
          Copy to Clipboard
        {/if}
      </button>
      <Tooltip
        let:trigger
        disabled={!(opts?.upgradeable === "transparent")}
        theme="light-red border"
        hideOnClick={false}
        interactive
      >
        <button
          use:trigger
          class="action-button"
          class:disabled={opts?.upgradeable === "transparent"}
          on:click={remixHandler}
        >
          <RemixIcon />
          Open in Remix
        </button>
        <div slot="content">
          Transparent upgradeable contracts are not supported on Remix. Try
          using Remix with UUPS upgradability or use Hardhat or Truffle with
          <a
            href="https://docs.openzeppelin.com/upgrades-plugins/"
            target="_blank"
            rel="noopener noreferrer">OpenZeppelin Upgrades</a
          >.
          <br />
          <!-- <a on:click={remixHandler}>Open in Remix anyway</a>. -->
        </div>
      </Tooltip>
      <Dropdown let:active>
        <button class="action-button" class:active slot="button">
          <DownloadIcon />
          Download
        </button>
        <button class="download-option" on:click={downloadNpmHandler}>
          <FileIcon />
          <div class="download-option-content">
            <p>Single file</p>
            <p>
              Requires installation of npm package (<code
                >@openzeppelin/contracts</code
              >).
            </p>
            <p>Simple to receive updates.</p>
          </div>
        </button>
        {#if opts?.kind !== "Governor"}
          <button class="download-option" on:click={downloadHardhatHandler}>
            <ZipIcon />
            <div class="download-option-content">
              <p>Development Package (Hardhat)</p>
              <p>
                Sample Hardhat project to get started with development and
                testing.
              </p>
            </div>
          </button>
        {/if}
        {#if opts?.kind !== "Governor"}
          <button class="download-option" on:click={downloadFoundryHandler}>
            <ZipIcon />
            <div class="download-option-content">
              <p>Development Package (Foundry)</p>
              <p>
                Sample Foundry project to get started with development and
                testing.
              </p>
            </div>
          </button>
        {/if}
      </Dropdown>
    </div>
  </div>
  <div class="flex flex-row gap-4 grow">
    <div
      class="controls w-64 flex flex-col shrink-0 justify-between h-[calc(100vh-84px)] overflow-auto"
    >
      <div class:hidden={tab !== "ERC20"}>
        <ERC20Controls bind:opts={allOpts.ERC20} />
      </div>
      <div class:hidden={tab !== "ERC721"}>
        <ERC721Controls bind:opts={allOpts.ERC721} />
      </div>
      <div class:hidden={tab !== "ERC1155"}>
        <ERC1155Controls bind:opts={allOpts.ERC1155} />
      </div>
      <div class:hidden={tab !== "Governor"}>
        <GovernorControls
          bind:opts={allOpts.Governor}
          errors={errors.Governor}
        />
      </div>
      <div class:hidden={tab !== "Custom"}>
        <CustomControls bind:opts={allOpts.Custom} />
      </div>
    </div>
    <div class="output flex flex-col grow overflow-auto h-[calc(100vh-84px)]">
      <pre class="flex flex-col grow basis-0 overflow-auto"><code
          class="hljs grow overflow-auto p-4">{@html highlightedCode}</code
        ></pre>
    </div>
  </div>
</div>

<style lang="postcss">
  .container {
    background-color: var(--gray-6);
    border: 1px solid var(--gray-2);
    border-radius: 10px;
    min-width: 32rem;
  }
  .header {
    font-size: var(--text-small);
  }
  .tab {
    color: var(--gray-4);
  }
  .tab button,
  .action-button,
  :global(.overflow-btn) {
    padding: var(--size-2) var(--size-3);
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
  }
  .tab button,
  :global(.overflow-btn) {
    border: 0;
    background-color: transparent;
  }
  .tab button:hover,
  :global(.overflow-btn):hover {
    background-color: var(--solidity-blue-1);
    color: white;
  }
  .tab button.selected {
    background-color: var(--solidity-blue-1);
    color: white;
    order: -1;
  }
  :global(.overflow-menu) button.selected {
    order: unset;
  }
  .action-button {
    background-color: var(--gray-1);
    border: 1px solid var(--gray-3);
    color: var(--gray-6);
    cursor: pointer;
    &:hover {
      background-color: var(--gray-2);
    }
    &:active,
    &.active {
      background-color: var(--gray-2);
    }
    &.disabled {
      color: var(--gray-4);
    }
    :global(.icon) {
      margin-right: var(--size-1);
    }
  }
  .controls {
    background-color: var(--gray-3);
    padding: var(--size-4);
  }
  .controls,
  .output {
    border-radius: 5px;
    box-shadow: var(--shadow);
  }

  .download-option {
    display: flex;
    padding: var (--size-2);
    text-align: left;
    background: none;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    :global(.icon) {
      margin-top: var (--icon-adjust);
    }
    :not(:hover) + & {
      border-top: 1px solid var(--gray-2);
    }
    &:hover,
    &:focus {
      background-color: var (--gray-1);
      border: 1px solid var(--gray-3);
    }
    & div {
      display: block;
    }
  }
  .download-option-content {
    margin-left: var(--size-3);
    font-size: var(--text-small);
    & > :first-child {
      margin-bottom: var(--size-2);
      color: var (--gray-6);
      font-weight: bold;
    }
    & > :not(:first-child) {
      margin-top: var (--size-1);
      color: var (--gray-5);
    }
  }
</style>
