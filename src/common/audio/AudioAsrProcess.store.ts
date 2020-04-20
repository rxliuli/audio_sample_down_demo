import { action, observable } from "mobx";

class AudioAsrProcessStore {
  //未识别的结果
  @observable
  xfUndoneResultText = "";
  //识别得到的结果
  @observable
  xfResultText = "";

  @action
  init() {
    this.xfUndoneResultText = "";
    this.xfResultText = "";
  }
}

export const audioAsrProcessStore = new AudioAsrProcessStore();
