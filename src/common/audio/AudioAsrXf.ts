import CryptoJS from "crypto-js";
import md5Hex from "md5-hex";
import { logger } from "rx-util";

export class AsrXfTransform {
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

export interface ISpeechRecognition {
  start(): void;
  stop(): void;
  send(buffer: Float32Array): void;
}

export interface SpeechRecognitionMessage {
  text: string | null;
}

//region 讯飞的语音识别 -- 语音听写

/**
 * 语音听写关闭的来源
 */
enum AsrCloseSourceEnum {
  /**
   * 用户关闭
   */
  User,
  /**
   * 讯飞回调关闭
   */
  Auto
}

interface AudioAsrXfConfig {
  //从控制台获取的讯飞配置项
  appId: string;
  apiSecret: string;
  apiKey: string;

  //语言和方言
  language?: string;
  accent?: string;

  /**
   * 讯飞成功打开 Socket 连接后调用一次
   * @param e
   */
  onStart?: (e: Event) => void;
  /**
   * 每当讯飞返回识别文本就调用
   * 注：做成回调的形式主要原因是音频发送和返回文本并不一定是 1 对 1 的
   * @param e
   */
  onMessage?: (message: SpeechRecognitionMessage) => void;
  /**
   * 当讯飞语音发生错误时调用
   * 注：做成回调的形式是因为讯飞服务端可能会主动关闭连接，例如超过 1 分钟
   * @param e
   */
  onError?: (e: Event) => void;
  /**
   * 当讯飞语音关闭时调用
   * 注：做成回调的形式是因为讯飞服务端可能会主动关闭连接，例如超过 1 分钟
   * @param e
   */
  onClose?: (e: CloseEvent) => void;
}

export class AudioAsrXf implements ISpeechRecognition {
  private ws!: WebSocket;
  private state: "ing" | "end" = "ing";
  private buffer: number[] = [];
  private status = AsrCloseSourceEnum.Auto;

  constructor(private config: AudioAsrXfConfig) {
    this.config.language = config.language || "zh_cn";
    this.config.accent = config.accent || "mandarin";
  }

  /**
   * 启动连接
   */
  start() {
    this.state = "ing";

    let url = "wss://iat-api.xfyun.cn/v2/iat";
    const host = "iat-api.xfyun.cn";
    const apiKey = this.config.apiKey;
    const apiSecret = this.config.apiSecret;
    const date = new Date().toUTCString();
    const algorithm = "hmac-sha256";
    const headers = "host date request-line";
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
    const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret);
    const signature = CryptoJS.enc.Base64.stringify(signatureSha);
    const authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
    const authorization = btoa(authorizationOrigin);
    url = `${url}?authorization=${authorization}&date=${date}&host=${host}`;
    if ("WebSocket" in window) {
      this.ws = new WebSocket(url);
    } else {
      alert("不支持 WebSocket 连接，请更新浏览器");
      return null;
    }
    this.ws.addEventListener("open", e => {
      this.config.onStart && this.config.onStart(e);
      setTimeout(() => {
        this.wsOpened();
      }, 500);
    });
    this.ws.addEventListener("message", e => {
      // logger.log('当前音频缓存 buffer 的大小: ', this.buffer.length)
      this.config.onMessage &&
        this.config.onMessage(AudioAsrXf.getMessageStr(e));
      this.wsOnMessage(e);
    });
    this.ws.addEventListener("error", e => {
      this.config.onError && this.config.onError(e as ErrorEvent);
    });
    this.ws.addEventListener("close", e => {
      if (this.status !== AsrCloseSourceEnum.User) {
        this.start();
        return;
      }
      this.config.onClose && this.config.onClose(e);
      this.status = AsrCloseSourceEnum.Auto;
    });
  }

  private static getMessageStr(e: MessageEvent): SpeechRecognitionMessage {
    const jsonData = JSON.parse(e.data);
    if (jsonData.data && jsonData.data.result) {
      return {
        text: jsonData.data.result.ws.map((v: any) => v.cw[0].w).join("")
      };
    }
    return {
      text: null
    };
  }

  /**
   * 关闭连接
   * 注：此处不直接关闭连接的原因在于需要让讯飞单独追加最后一个标点符号
   */
  stop() {
    this.state = "end";
    this.status = AsrCloseSourceEnum.User;
    // this.ws.close()
  }

  /**
   * 将音频发送给讯飞
   * @param buffer
   */
  send(buffer: Float32Array) {
    this.buffer.push(...AsrXfTransform.transaction(buffer));
  }

  private wsOpened() {
    if (this.ws.readyState !== 1) {
      return;
    }
    let audioData = this.buffer.splice(0, 2048);
    const params = {
      common: {
        app_id: this.config.appId
      },
      business: {
        language: this.config.language, //小语种可在控制台--语音听写（流式）--方言/语种处添加试用
        //TODO domain 无法设置为 medical
        domain: "iat",
        accent: this.config.accent, //中文方言可在控制台--语音听写（流式）--方言/语种处添加试用
        vad_eos: 10000, // 默认静默时间
        // dwa: 'wpgs', //为使该功能生效，需到控制台开通动态修正功能（该功能免费）
        ptt: 0 //（仅中文支持）是否开启标点符号添加
      },
      data: {
        status: 0,
        format: "audio/L16;rate=16000",
        encoding: "raw",
        audio: AsrXfTransform.toBase64(audioData)
      }
    };
    this.ws.send(JSON.stringify(params));
    const handlerInterval = setInterval(() => {
      // websocket未连接
      if (this.ws.readyState !== 1) {
        clearInterval(handlerInterval);
        return;
      }
      if (this.buffer.length === 0) {
        if (this.state === "end") {
          this.ws.send(
            JSON.stringify({
              data: {
                status: 2,
                format: "audio/L16;rate=16000",
                encoding: "raw",
                audio: ""
              }
            })
          );
          clearInterval(handlerInterval);
        }
        return false;
      }
      audioData = this.buffer.splice(0, 2048);
      // logger.log('当前音频剩余大小：', this.buffer.length)
      // 中间帧
      this.ws.send(
        JSON.stringify({
          data: {
            status: 1,
            format: "audio/L16;rate=16000",
            encoding: "raw",
            audio: AsrXfTransform.toBase64(audioData)
          }
        })
      );
    }, 40);
  }

  private wsOnMessage(e: MessageEvent) {
    const jsonData = JSON.parse(e.data);
    // 识别结束
    if (jsonData.code === 0 && jsonData.data.status === 2) {
      this.ws.close();
    }
    if (jsonData.code !== 0) {
      this.ws.close();
      console.log(`${jsonData.code}:${jsonData.message}`);
    }
  }
}

//endregion

//region 讯飞的语音识别 -- 实时语音转写

interface AudioRtasrConfig {
  //从控制台获取的讯飞配置项
  appId: string;
  apiSecret: string;

  onClose: (e: CloseEvent) => void;
  onError: (e: Event) => void;
  onMessage: (e: SpeechRecognitionMessage) => void;
  onStart: (e: Event) => void;
}

//讯飞开启动态修正后的识别结果类型
enum AudioRtasrResultTypeEnum {
  Result = "0",
  Process = "1"
}

export class AudioRtasrXf implements ISpeechRecognition {
  private buffer: number[] = [];
  private ws!: WebSocket;
  private state: "ing" | "end" = "ing";
  private handlerInterval: number = 0;
  constructor(private config: AudioRtasrConfig) {}

  send(buffer: Float32Array): void {
    this.buffer.push(...AsrXfTransform.transaction(buffer));
    // logger.info('新增 buffer: ', this.buffer.length)
  }

  start(): void {
    this.buffer.length = 0;
    this.state = "ing";
    this.connectWebsocket();
  }

  // 生成握手参数
  private getHandShakeParams() {
    const appId = this.config.appId;
    const secretKey = this.config.apiSecret;
    const ts = Math.floor(new Date().getTime() / 1000); //new Date().getTime()/1000+'';
    const signa = md5Hex(appId + ts); //hex_md5(encodeURIComponent(appId + ts));//EncryptUtil.HmacSHA1Encrypt(EncryptUtil.MD5(appId + ts), secretKey);
    const signatureSha = CryptoJS.HmacSHA1(signa, secretKey);
    let signature = CryptoJS.enc.Base64.stringify(signatureSha);
    signature = encodeURIComponent(signature);
    return `?appid=${appId}&ts=${ts}&signa=${signature}&pd=medical`;
  }
  private connectWebsocket() {
    let url = "wss://rtasr.xfyun.cn/v1/ws";
    const urlParam = this.getHandShakeParams();

    url = `${url}${urlParam}`;
    this.ws = new WebSocket(url);
    this.ws.addEventListener("open", e => {
      setTimeout(() => {
        this.wsOpened();
      }, 500);
      this.config.onStart && this.config.onStart(e);
    });
    this.ws.addEventListener("message", e => {
      this.config.onMessage &&
        this.config.onMessage(AudioRtasrXf.getMessageStr(e));
      this.wsOnMessage(e);
    });
    this.ws.addEventListener("error", e => {
      this.stop();
      console.log("关闭连接ws.onerror");
      this.config.onError && this.config.onError(e);
    });
    this.ws.addEventListener("close", e => {
      this.stop();
      console.log("关闭连接ws.onclose");
      this.config.onClose && this.config.onClose(e);
    });
  }

  private wsOpened() {
    if (this.ws.readyState !== 1) {
      return;
    }
    const audioData = this.buffer.splice(0, 2048);
    this.ws.send(new Int8Array(audioData));
    this.handlerInterval = setInterval(() => {
      // websocket未连接
      if (this.ws.readyState !== 1) {
        clearInterval(this.handlerInterval);
        return;
      }
      if (this.buffer.length === 0) {
        if (this.state === "end") {
          this.ws.send('{"end": true}');
          console.log("发送结束标识");
          clearInterval(this.handlerInterval);
        }
        return false;
      }
      const audioData = this.buffer.splice(0, 2048);
      // logger.log('剩余的 Data: ', this.buffer.length)
      if (audioData.length > 0) {
        this.ws.send(new Int8Array(audioData));
      }
    }, 40) as any;
  }

  private static getMessageStr(e: MessageEvent): SpeechRecognitionMessage {
    const jsonData = JSON.parse(e.data);
    if (jsonData.action === "result") {
      const st = JSON.parse(jsonData.data).cn.st;
      if (st.type === AudioRtasrResultTypeEnum.Result) {
        return {
          text: st.rt[0].ws.map((v: any) => v.cw[0].w).join("")
        };
      } else if (st.type === AudioRtasrResultTypeEnum.Process) {
        logger.log(
          "中间结果：",
          st.rt[0].ws.map((v: any) => v.cw[0].w).join("")
        );
      }
    }
    return {
      text: null
    };
  }

  wsOnMessage(e: MessageEvent) {
    let jsonData = JSON.parse(e.data);
    if (jsonData.action === "started") {
      // 握手成功
      console.log("握手成功");
    } else if (jsonData.action === "error") {
      // 连接发生错误
      console.log("出错了:", jsonData);
    }
  }

  stop(): void {
    this.state = "end";
  }
}

//endregion
