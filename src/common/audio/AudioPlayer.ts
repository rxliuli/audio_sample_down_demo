/**
 * 简单封装音频播放器
 */
export class AudioPlayer {
  private readonly $audioPlayer: HTMLAudioElement
  constructor(url: string) {
    const el = document.createElement('audio') as HTMLAudioElement
    el.src = url
    el.autoplay = false
    document.body.appendChild(el)
    this.$audioPlayer = el
  }
  async play() {
    await this.$audioPlayer.play()
  }
  set(url: string) {
    if (!this.$audioPlayer) {
      throw new Error('AudioPlayer 未初始化')
    }
    this.$audioPlayer.src = url
  }
  pause() {
    this.$audioPlayer.pause()
  }
}
