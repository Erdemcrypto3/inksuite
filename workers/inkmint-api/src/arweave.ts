import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha384 } from '@noble/hashes/sha2.js';
import { hexToBytes, concatBytes } from '@noble/hashes/utils.js';
import { Wallet } from '@ethersproject/wallet';
import { arrayify } from '@ethersproject/bytes';

const IRYS_NODE = 'https://node1.irys.xyz';
const IRYS_GATEWAY = 'https://gateway.irys.xyz';
const SIG_TYPE_ETHEREUM = 3;

const encoder = new TextEncoder();

function stringToBytes(s: string): Uint8Array {
  return encoder.encode(s);
}

type DeepHashInput = Uint8Array | DeepHashInput[];

function deepHash(data: DeepHashInput): Uint8Array {
  if (data instanceof Uint8Array) {
    const tagInput = concatBytes(stringToBytes('blob'), stringToBytes(data.byteLength.toString()));
    const tagHash = sha384(tagInput);
    const dataHash = sha384(data);
    return sha384(concatBytes(tagHash, dataHash));
  }

  const listTag = concatBytes(stringToBytes('list'), stringToBytes(data.length.toString()));
  let hash = sha384(listTag);

  for (const chunk of data) {
    const chunkHash = deepHash(chunk);
    hash = sha384(concatBytes(hash, chunkHash));
  }

  return hash;
}

function zigzagEncode(n: number): number {
  return (n << 1) ^ (n >> 31);
}

function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  let v = value >>> 0;
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v & 0x7f);
  return new Uint8Array(bytes);
}

function avroLong(n: number): Uint8Array {
  return encodeVarint(zigzagEncode(n));
}

function avroBytes(buf: Uint8Array): Uint8Array {
  return concatBytes(avroLong(buf.length), buf);
}

interface Tag {
  name: string;
  value: string;
}

function serializeAvroTags(tags: Tag[]): Uint8Array {
  if (tags.length === 0) return new Uint8Array(0);

  const parts: Uint8Array[] = [avroLong(tags.length)];

  for (const { name, value } of tags) {
    parts.push(avroBytes(stringToBytes(name)));
    parts.push(avroBytes(stringToBytes(value)));
  }

  parts.push(new Uint8Array([0]));
  return concatBytes(...parts);
}

async function ethSignMessage(message: Uint8Array, privateKeyHex: string): Promise<Uint8Array> {
  const wallet = new Wallet(privateKeyHex);
  const sigHex = await wallet.signMessage(message);
  return new Uint8Array(arrayify(sigHex));
}

async function createSignedDataItem(
  data: Uint8Array,
  tags: Tag[],
  privateKeyHex: string
): Promise<Uint8Array> {
  const privKey = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
  const privateKey = hexToBytes(privKey);
  const publicKey = secp256k1.getPublicKey(privateKey, false);

  const target = new Uint8Array(0);
  const anchor = new Uint8Array(0);
  const serializedTags = serializeAvroTags(tags);

  const signatureData = deepHash([
    stringToBytes('dataitem'),
    stringToBytes('1'),
    stringToBytes(SIG_TYPE_ETHEREUM.toString()),
    publicKey,
    target,
    anchor,
    serializedTags,
    data,
  ]);

  const signature = await ethSignMessage(signatureData, privateKeyHex);

  const sigType = new Uint8Array(2);
  new DataView(sigType.buffer).setUint16(0, SIG_TYPE_ETHEREUM, true);

  const targetPresent = new Uint8Array([0]);
  const anchorPresent = new Uint8Array([0]);

  const numTags = new Uint8Array(8);
  new DataView(numTags.buffer).setBigUint64(0, BigInt(tags.length), true);

  const numTagBytes = new Uint8Array(8);
  new DataView(numTagBytes.buffer).setBigUint64(0, BigInt(serializedTags.length), true);

  return concatBytes(
    sigType,
    signature,
    publicKey,
    targetPresent,
    anchorPresent,
    numTags,
    numTagBytes,
    serializedTags,
    data,
  );
}

interface IrysReceipt {
  id: string;
}

async function postToIrys(signedDataItem: Uint8Array, token: string): Promise<IrysReceipt> {
  const res = await fetch(`${IRYS_NODE}/tx/${token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': signedDataItem.byteLength.toString(),
    },
    body: signedDataItem,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    throw new Error(`Irys upload failed (${res.status}): ${errText}`);
  }

  return (await res.json()) as IrysReceipt;
}

export interface ArweaveEnv {
  IRYS_PRIVATE_KEY?: string;
  IRYS_TOKEN?: string;
}

export interface ArweaveResult {
  id: string;
  url: string;
}

export async function uploadToArweave(
  data: Uint8Array | ArrayBuffer | string,
  contentType: string,
  env: ArweaveEnv
): Promise<ArweaveResult | null> {
  if (!env.IRYS_PRIVATE_KEY) {
    return null;
  }

  const tags: Tag[] = [
    { name: 'Content-Type', value: contentType },
    { name: 'App-Name', value: 'InkSuite' },
    { name: 'App-Version', value: '1.0.0' },
  ];

  const dataBytes =
    typeof data === 'string'
      ? stringToBytes(data)
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);

  const token = env.IRYS_TOKEN || 'ethereum';

  try {
    const signedItem = await createSignedDataItem(dataBytes, tags, env.IRYS_PRIVATE_KEY);
    const receipt = await postToIrys(signedItem, token);

    return {
      id: receipt.id,
      url: `${IRYS_GATEWAY}/${receipt.id}`,
    };
  } catch (e) {
    console.error('[ARWEAVE] Upload failed, falling back to R2:', (e as Error).message);
    return null;
  }
}
