import * as React from "react";
import { useState } from "react";
import { AudioConvert } from "../common/audio/AudioConvert";
import { AudioPlayer } from "../common/audio/AudioPlayer";
import { download } from "rx-util";
import {
  AudioAsrProcess,
  IAudioAsrProcess
} from "../common/audio/AudioAsrProcess";
import { message } from "antd";
import { audioAsrProcessStore } from "../common/audio/AudioAsrProcess.store";
import { observer } from "mobx-react";

type PropsType = {};

const AudioXfDemo: React.FC<PropsType> = observer(() => {
  const [audioAsrProcess] = useState<IAudioAsrProcess>(new AudioAsrProcess());
  const [resultAudio, setResultAudio] = useState<Blob>();

  function start() {
    console.log("开始录音");
    audioAsrProcess.start();
  }
  function stop() {
    console.log("结束录音");
    audioAsrProcess.stop();
    const hide = message.loading("正在转换 mp3", 0);
    let blob = AudioConvert.float32ArrayToMp3(
      audioAsrProcess.audioRecorder.dataList
    );
    setResultAudio(blob);
    hide();
  }
  function play() {
    console.log("开始播放");
    new AudioPlayer(URL.createObjectURL(resultAudio)).play();
  }

  function down() {
    console.log("开始下载");
    download(resultAudio!, "录制的音频.mp3");
  }

  return (
    <div>
      <header>
        <button onClick={start}>开始录音</button>
        <button onClick={stop}>结束录音</button>
        <button onClick={play}>播放音频</button>
        <button onClick={down}>下载音频</button>
      </header>
      <div>
        <section
          style={{
            display: "inline-block",
            width: "50%"
          }}
        >
          <h3>识别过程中的文本</h3>
          <p>{audioAsrProcessStore.xfUndoneResultText}</p>
        </section>
        <section
          style={{
            display: "inline-block",
            width: "50%"
          }}
        >
          <h3>识别出来的文本</h3>
          <p>{audioAsrProcessStore.xfResultText}</p>
        </section>
      </div>
    </div>
  );
});

export default AudioXfDemo;
