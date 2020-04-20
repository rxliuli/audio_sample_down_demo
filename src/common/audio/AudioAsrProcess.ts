import {
  AudioRtasrXf,
  ISpeechRecognition,
  SpeechRecognitionMessage
} from "./AudioAsrXf";
import { audioAsrProcessStore } from "./AudioAsrProcess.store";
import { EventEmitter, logger, StringValidator } from "rx-util";
import { AudioRecorder } from "./AudioRecorder";
import { Modal } from "antd/es";

export enum AudioEventEnum {
  Stop,
  Error
}

/**
 * 暴露的接口
 */
export interface IAudioAsrProcess {
  readonly audioAsrXf: ISpeechRecognition;
  readonly audioRecorder: AudioRecorder;

  /**
   * 开始识别
   */
  start(): void;

  /**
   * 结束识别
   */
  stop(): void;

  /**
   * 事件监听
   * @param event
   * @param func
   */
  on<T extends AudioEventEnum>(event: T, func: Function): void;
}

/**
 * 语音识别相关处理程序
 */
export class AudioAsrProcess implements IAudioAsrProcess {
  private static xfAppConfig = {
    appId: "****",
    apiKey: "****",
    apiSecret: "*****"
  };

  readonly audioAsrXf: ISpeechRecognition;
  readonly audioRecorder: AudioRecorder;

  constructor() {
    //初始化一些内容
    this.on = this.em.add.bind(this.em);
    //初始化讯飞语音识别实例
    this.audioAsrXf = new AudioRtasrXf({
      ...AudioAsrProcess.xfAppConfig,
      onStart: AudioAsrProcess.onStart.bind(this),
      onError: this.onError.bind(this),
      onClose: AudioAsrProcess.onClose.bind(this),
      onMessage: this.onMessage.bind(this)
    });

    this.audioRecorder = new AudioRecorder({
      onAudioProcess: e => {
        this.audioAsrXf.send(e.inputBuffer.getChannelData(0).slice(0));
      }
    });
  }

  /**
   * 开始识别
   */
  async start() {
    // logger.log('AudioAsrProcess.start: 开始讯飞语音识别')
    try {
      await this.audioRecorder.start();
    } catch (err) {
      if (err.name === "NotAllowedError") {
        await Modal.warning({
          title: "提示",
          content:
            "检测到麦克风权限已被禁用，请在浏览器设置中，允许使用麦克风。",
          okText: "好的"
        });
      } else {
        await Modal.warning({
          title: "提示",
          content: "检测未连接麦克风，请确认后重试。",
          okText: "好的"
        });
      }
      return;
    }
    audioAsrProcessStore.init();
    await this.audioAsrXf.start();
  }

  /**
   * 结束识别
   */
  stop() {
    // logger.log('AudioAsrProcess.stop: 结束讯飞语音识别')
    this.audioAsrXf.stop();
    this.audioRecorder.stop();
    this.clear();
  }

  private em = new EventEmitter<{
    [AudioEventEnum.Stop]: [object];
    [AudioEventEnum.Error]: [Event];
  }>();

  /**
   * 事件监听
   * @param event
   * @param func
   */
  on = this.em.add;
  private clear() {
    [AudioEventEnum.Stop].forEach(type => this.em.removeByType(type));
  }

  //region 内部实现的私有方法

  //region 讯飞监听事件

  private static async distinguishCommand(text: string) {
    logger.info("讯飞后的命令词：", text);
    //TODO 一些自定义操作
  }

  private static onStart() {
    logger.info("onStart: 开始识别");
    // this.audioAsrXf.clear()
  }
  private onError(e: Event) {
    logger.info("onError: 识别错误");
    this.stop();
    this.em.emit(AudioEventEnum.Error, e);
  }

  private static async onClose() {
    logger.info("onClose: 结束识别：开始");
    //TODO 一些终结操作
    logger.info("onClose: 结束识别：完成");
  }
  async onMessage(msg: SpeechRecognitionMessage) {
    const str = msg.text;
    if (StringValidator.isEmpty(str)) {
      return;
    }
    audioAsrProcessStore.xfResultText += str!;
    await AudioAsrProcess.distinguishCommand(str!);
  }

  //endregion
}
