
export type AudioRecorderConfig = {
  onAudioProcess: (event: ScriptProcessorNodeEventMap['audioprocess']) => void
}
export interface IAudioRecorder {
  /**
   * 录音保存的数据
   * 如果想转换成 Mp3，可以使用 {@link AudioConvert} 类
   */
  readonly dataList: Float32Array[]

  /**
   * 开始录音
   */
  start(): Promise<void>

  /**
   * 停止录音
   */
  stop(): void
}

export class AudioRecorder implements IAudioRecorder {
  private mediaStream!: MediaStream
  private mediaNode!: MediaStreamAudioSourceNode
  private jsNode!: ScriptProcessorNode
  private audioContext!: AudioContext

  readonly dataList: Float32Array[] = []

  constructor(private config: AudioRecorderConfig) {}

  private static async requirePermission() {
    try {
      return await window.navigator.mediaDevices.getUserMedia({
        audio: true,
      })
    } catch (err) {
      // 如果用户电脑没有麦克风设备或者用户拒绝了，或者连接出问题了等
      // 这里都会抛异常，并且通过err.name可以知道是哪种类型的错误
      if (err.name === 'NotAllowedError') {
        console.log('用户不允许使用麦克风权限')
      } else {
        console.error(err)
      }
      throw err
    }
  }
  private static createJSNode(audioContext: AudioContext) {
    const bufferSize = 0
    const inputChannelCount = 1
    const outputChannelCount = 1
    return audioContext.createScriptProcessor(
      bufferSize,
      inputChannelCount,
      outputChannelCount,
    )
  }

  async start() {
    this.clear()
    this.mediaStream = await AudioRecorder.requirePermission()
    const audioContext = new AudioContext()
    this.audioContext = audioContext
    console.log('麦克风采样率：', audioContext.sampleRate)
    this.mediaNode = audioContext.createMediaStreamSource(this.mediaStream)
    // 创建一个jsNode
    this.jsNode = AudioRecorder.createJSNode(audioContext)
    // 需要连到扬声器消费掉outputBuffer，process回调才能触发
    // 并且由于不给outputBuffer设置内容，所以扬声器不会播放出声音
    this.jsNode.connect(audioContext.destination)
    this.jsNode.addEventListener('audioprocess', e =>
      this.dataList.push(e.inputBuffer.getChannelData(0).slice(0)),
    )
    if (this.config.onAudioProcess) {
      this.jsNode.addEventListener('audioprocess', e => {
        // logger.log('添加音频大小：', e.inputBuffer.getChannelData(0).length)
        this.config.onAudioProcess(e)
      })
    }
    // 把mediaNode连接到jsNode
    this.mediaNode.connect(this.jsNode)
  }
  stop() {
    // 停止录音
    this.mediaStream.getAudioTracks()[0].stop()
    this.mediaNode.disconnect()
    this.jsNode.disconnect()
  }

  clear() {
    this.dataList.length = 0
  }
}
