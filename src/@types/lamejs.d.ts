declare module 'lamejs' {
    export class Mp3Enc {
        constructor(channels: number, sampleRate: number, kbps: number)
        encodeBuffer(mono: Int16Array): number[]
        flush(): number[]
    }
    const lamejs: {
        Mp3Encoder: ClassDecorator<Mp3Enc>
    }
    export default lamejs
}
