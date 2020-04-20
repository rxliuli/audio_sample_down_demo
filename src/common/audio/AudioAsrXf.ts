export class AsrXfTransform {
  static interleave(
    e: Float32Array,
    sampleRate: number,
    outputSampleRate: number
  ) {
    const t = e.length;
    sampleRate += 0.0;
    outputSampleRate += 0.0;
    let s = 0;
    const o = sampleRate / outputSampleRate,
      u = Math.ceil((t * outputSampleRate) / sampleRate),
      a = new Float32Array(u);
    for (let i = 0; i < u; i++) {
      a[i] = e[Math.floor(s)];
      s += o;
    }
    return a;
  }

  static transaction(buffer: Float32Array) {
    const bufTo16kHz = AsrXfTransform.to16kHz(buffer);
    return AsrXfTransform.to16BitPCM(bufTo16kHz);
  }
  static to16kHz(buffer: Float32Array): Float32Array {
    const data = new Float32Array(buffer);
    const fitCount = Math.round(data.length * (16000 / 44100));
    const newData = new Float32Array(fitCount);
    const springFactor = (data.length - 1) / (fitCount - 1);
    newData[0] = data[0];
    for (let i = 1; i < fitCount - 1; i++) {
      const tmp = i * springFactor;
      const before = parseInt(Math.floor(tmp).toFixed());
      const after = parseInt(Math.ceil(tmp).toFixed());
      const atPoint = tmp - before;
      newData[i] = data[before] + (data[after] - data[before]) * atPoint;
    }
    newData[fitCount - 1] = data[data.length - 1];
    return newData;
  }

  static to16BitPCM(input: Float32Array): number[] {
    const dataLength = input.length * (16 / 8);
    const dataBuffer = new ArrayBuffer(dataLength);
    const dataView = new DataView(dataBuffer);
    let offset = 0;
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      dataView.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return Array.from(new Int8Array(dataView.buffer));
  }
  static toBase64(buffer: any) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
