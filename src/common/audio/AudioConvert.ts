import lamejs, { Mp3Enc } from 'lamejs'

/**
 * 音频转换
 */
export class AudioConvert {
  /**
   * 录音获得的 Float32Array 的数组转换成 Mp3 格式的 Blob 对象
   * @param data
   */
  static float32ArrayToMp3(data: Float32Array[]): Blob {
    const audioData = AudioConvert.mergeArray(data)
    const int16Buffer = AudioConvert.floatArray2Int16(audioData)
    return AudioConvert.encodeMono(1, 44100, int16Buffer)
  }

  /**
   * 合并单个声道的多个片段
   * @param list
   */
  private static mergeArray(list: Float32Array[]) {
    const length = list.length * list[0].length
    let data = new Float32Array(length),
      offset = 0
    for (let i = 0; i < list.length; i++) {
      data.set(list[i], offset)
      offset += list[i].length
    }
    return data
  }

  private static floatArray2Int16(floatBuffer: Float32Array) {
    const int16Buffer = new Int16Array(floatBuffer.length)
    for (let i = 0, len = floatBuffer.length; i < len; i++) {
      if (floatBuffer[i] < 0) {
        int16Buffer[i] = 0x8000 * floatBuffer[i]
      } else {
        int16Buffer[i] = 0x7fff * floatBuffer[i]
      }
    }
    return int16Buffer
  }

  private static encodeMono(
    channels: number,
    sampleRate: number,
    samples: Int16Array,
  ) {
    const buffer = []
    const mp3enc: Mp3Enc = new lamejs.Mp3Encoder(channels, sampleRate, 128)
    let remaining = samples.length
    const maxSamples = 1152
    for (let i = 0; remaining >= maxSamples; i += maxSamples) {
      const mono = samples.subarray(i, i + maxSamples)
      const mp3buf = mp3enc.encodeBuffer(mono)
      if (mp3buf.length > 0) {
        buffer.push(new Int8Array(mp3buf))
      }
      remaining -= maxSamples
    }
    const d = mp3enc.flush()
    if (d.length > 0) {
      buffer.push(new Int8Array(d))
    }

    // console.log('done encoding, size=', buffer.length)
    return new Blob(buffer, { type: 'audio/mp3' })
  }
}
