import * as React from "react";
import { useState } from "react";
import { AsrXfTransform } from "../common/audio/AudioAsrXf";
import { AudioRecorder } from "../common/audio/AudioRecorder";
import { AudioConvert } from "../common/audio/AudioConvert";
import { AudioPlayer } from "../common/audio/AudioPlayer";
import { download } from "rx-util";

type PropsType = {};

const AudioRecordZipDemo: React.FC<PropsType> = props => {
  const [dataList, setDataList] = useState<Float32Array[]>([]);
  const [audioRecorder] = useState(
    new AudioRecorder({
      onAudioProcess: e => {
        dataList.push(
          AsrXfTransform.interleave(
            e.inputBuffer.getChannelData(0).slice(0),
            44100,
            16000
          )
        );
        setDataList(dataList);
      }
    })
  );
  const [resultAudio, setResultAudio] = useState<Blob>();

  function start() {
    console.log("开始录音");
    audioRecorder.start();
  }
  function stop() {
    console.log("结束录音");
    audioRecorder.stop();
    setResultAudio(AudioConvert.float32ArrayToMp3(dataList));
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
      <button onClick={start}>开始录音</button>
      <button onClick={stop}>结束录音</button>
      <button onClick={play}>播放音频</button>
      <button onClick={down}>下载音频</button>
    </div>
  );
};

export default AudioRecordZipDemo;
