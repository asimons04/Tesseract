import { Buffer } from 'buffer'
import type { GetCommunityResponse, GetSiteResponse } from 'lemmy-js-client'

export interface StorageControllerOptions {
    type?: 'local' | 'session'                  // Use Session or Local storage
    ttl?: number                                // Minutes the storage should be valid
    compressionOptions?: CompressionOptions     // Options to pass to the StringCompression class
    useCompression?: boolean                    // Whether to use compression or store the data as-is
}

export interface StorageControllerData {
    timestamp: number,
    payload: string,
    size: number
}

export class StorageController {
    _type: 'local' | 'session'
    _ttl: number
    compressor
    useCompression: boolean

    constructor(opts?:StorageControllerOptions) {
        this._type = opts?.type ?? 'session'
        this._ttl = (opts?.ttl ?? 15) * 60
        this.useCompression = opts?.useCompression ?? true
        this.compressor = new StringCompression(opts?.compressionOptions)

    }

    get keys() {
        return this._type == 'session'
            ? Object.keys(sessionStorage)
            : Object.keys(localStorage)
    }

    /** Compresses an object and returns a base64 representation of the compressed string */
    async compress (obj: any): Promise<string|undefined> {
        if (!obj) return undefined
        try {
            return await this.compressor.compress( JSON.stringify(obj) )
            
        }
        catch { return undefined }
    }
    
    /** Decompresses a base64-encoded string representing a compressed Uint8Array */
    async decompress(compressed:string): Promise<any|undefined> {
        if (!compressed) return undefined

        try {
            return JSON.parse(
                await this.compressor.decompress(compressed)
            )
        }
        catch { return undefined }
    }

    remove (key:string): void {
        // Prevent removing critical data from local storage; these keys are not managed by the storage controller.
        if (this._type == 'local' && ['theme', 'profileData', 'settings', 'seenUntil'].includes(key)) {
            console.log(`StorageController: Cannot remove key (${key}) from localStorage as it is required and not managed by this subsystem.`)
            return
        }
        
        (this._type == 'session')    
            ? sessionStorage.removeItem(key)
            : localStorage.removeItem(key)
        
    }

    expired (timestamp?:number): boolean {
        if (!timestamp || this._ttl < 0) return false

        const now = Math.round(new Date().getTime() /1000)
        if (now - timestamp > this._ttl) return true
        return false
        
    }

    // Alias for retrieve
    async get (key:string): Promise<any> {
        return await this.retrieve(key)
    }

    // Alias for store
    async put (key:string, data: any) {
        return await this.store(key, data)
    }

    async retrieve (key:string): Promise<any> {
        try { 
            const value = (this._type == 'session')
                ? sessionStorage.getItem(key)
                : localStorage.getItem(key)

            if (!value) return undefined

            const data = JSON.parse(value)

            if ( !('payload' in data)) return undefined
            
            if (this.expired(data.timestamp)) {
                console.log(`StorageController: Stored item (${key}) is expired. Discarding`)
                this.remove(key)
                return undefined
            }

            const decompressed = this.useCompression ? await this.decompress(data.payload) : JSON.parse(data.payload)
            if (!decompressed) throw new Error("Failed to decompress retrieved data")

            return decompressed
        }
        catch (err) { 
            console.log(`StorageController: Error retrieving key (${key}:`, err)
            this.remove(key)
            return undefined 
        }
    }
    
    async store (key:string, data:any) {
        if (!key || !data) return
        
        try {

            const payloadData = this.useCompression ? await this.compress(data) : JSON.stringify(data)
            if (!payloadData) throw new Error('Failed to compress data')
            
            const dataLength = JSON.stringify(data).length
            const compressedDataLength = payloadData.length

            const payload = {
                size: dataLength,
                compressed_size: compressedDataLength,
                compress_ratio: (dataLength / compressedDataLength).toFixed(2),
                payload: payloadData,
                timestamp: Math.round(new Date().getTime() /1000)
            } as StorageControllerData
            
            this._type == 'session'
                ? sessionStorage.setItem(key, JSON.stringify(payload))
                : localStorage.setItem(key, JSON.stringify(payload))

        }
        catch (err) {
            console.log(`StorageController: Failed to save to ${this._type} storage.`, err)
            this.remove(key)
        }
    }
}



// String Compression Classes
export interface CompressionOptions {
    format: CompressionFormat
}


export class StringCompression {
    _format: CompressionFormat

    constructor(opts?: CompressionOptions) {
        this._format = opts?.format ?? 'gzip'
    }

    
    async compress (str:string): Promise<string> {
        const compressedStream = new Blob([str]).stream().pipeThrough(
            new CompressionStream(this._format)
        )
        const chunks = [];
        for await (const chunk of compressedStream) {
          chunks.push(chunk);
        }
        return this.bufferTob64(await this.concatUint8Arrays(chunks))
    }

    async decompress(compressedString: string): Promise<string> {
        const compressedBytes = this.b64ToBuffer(compressedString)

        const decompressedStream = new Blob([compressedBytes]).stream().pipeThrough(
            new DecompressionStream(this._format)
        )
        const chunks = [];
        for await (const chunk of decompressedStream) {
          chunks.push(chunk);
        }
        const stringBytes = await this.concatUint8Arrays(chunks);
      
        // Convert the bytes to a string.
        return new TextDecoder().decode(stringBytes);
      }

    async concatUint8Arrays(uint8arrays:Uint8Array[]): Promise<Uint8Array> {
        return new Uint8Array(
            await new Blob(uint8arrays).arrayBuffer()
        )
    }

    /** Serializes a Uint8Array buffer to a base64 string*/
    bufferTob64 (u8:Uint8Array): string {
        return Buffer.from(u8).toString('base64')
    }

    /**Deserializes a base64 encoded Uint8Array into a proper Uint8Array*/
    b64ToBuffer (b64:string): Uint8Array {
        return new Uint8Array(Buffer.from(b64, 'base64'))
    }
}