import { ed25519 } from '@noble/curves/ed25519'
import { toString } from 'uint8arrays'

const priv = ed25519.utils.randomPrivateKey()

export type Keypair = {
    private:Uint8Array;
    public:Uint8Array
}

export function generateKeys ():Keypair {  // eslint-disable-line indent
    return {
        private: priv,
        public: ed25519.getPublicKey(priv)
    }
}

export function generateAsString ():{
    private:string,
    public:string
} {  // eslint-disable-line indent
    const keypair = generateKeys()
    return keysToString(keypair)
}

export function keysToString (keys:Keypair):{ private:string, public:string } {
    return {
        private: toString(keys.private, 'base64pad'),
        public: toString(keys.public, 'base64pad')
    }
}
