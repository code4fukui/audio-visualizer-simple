const getDevices = async (kind) => {
  const devs = await navigator.mediaDevices.enumerateDevices();
  return devs.filter(d => d.kind == kind);
};
const getAudioInput = async () => getDevices("audioinput");
const getAudioOutput = async () => getDevices("audiooutput");

const addOptions = async () => {
  const ains = await getAudioInput();
  const aouts = await getAudioOutput();
  //const aouts = await navigator.mediaDevices.selectAudioOutput(); // not yet
  console.log(ains, aouts);

  for (const a of ains) {
    const opt = document.createElement("option");
    opt.value = a.deviceId;
    opt.textContent = a.label;
    audioin.appendChild(opt);
  }
  /*
  for (const a of aouts) {
    const opt = document.createElement("option");
    opt.value = a.deviceId;
    opt.textContent = a.label;
    audioout.appendChild(opt);
  }
  audioout.onchange = async () => {
    const deviceId = audioout.value;
    const eleaudio = document.createElement("audio");
    await eleaudio.setSinkId(deviceId);
    console.log("audiooutput: " + deviceId);
  };
  */
};

const init = async () => {
  heading.textContent = document.title;
  document.body.removeEventListener("click", init)

  // set up forked web audio context, for multiple browsers
  // window. is needed otherwise Safari explodes


  const audioCtx = new window.AudioContext;
  const voiceSelect = document.getElementById("voice");

  // grab the mute button to use below

  const mute = document.querySelector(".mute");

  // distortion curve for the waveshaper, thanks to Kevin Ennis
  // http://stackoverflow.com/questions/22312841/waveshaper-node-in-webaudio-how-to-emulate-distortion

  const makeDistortionCurve = (amount) => {
    const k = typeof amount === "number" ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; i++) {
      const x = i * 2 / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  };

  /*
  // grab audio track via XHR for convolver node
  let soundSource;
  const ajaxRequest = new XMLHttpRequest();
  ajaxRequest.open("GET", "https://mdn.github.io/voice-change-o-matic/audio/concert-crowd.ogg", true);
  ajaxRequest.responseType = "arraybuffer";

  ajaxRequest.onload = function() {
    const audioData = ajaxRequest.response;

    audioCtx.decodeAudioData(audioData, function(buffer) {
        soundSource = audioCtx.createBufferSource();
        soundSource.connect(audioCtx.destination);
        soundSource.loop = true;
        soundSource.start();
        console.log(soundSource);
    
        convolver.buffer = buffer;
      }, function(e) {
        console.log("Error with decoding audio data" + e.err);
      }
    );
  };
  ajaxRequest.send();
  */

  // set up canvas context for visualizer

  const canvas = document.querySelector(".visualizer");
  const canvasCtx = canvas.getContext("2d");

  const intendedWidth = document.querySelector(".wrapper").clientWidth;

  canvas.setAttribute("width", intendedWidth);

  const visualSelect = document.getElementById("visual");

  let drawVisual;

  //main block for doing the audio recording

  if (!navigator.mediaDevices.getUserMedia) {
    console.log("getUserMedia not supported on your browser!");
  }
  console.log("getUserMedia supported.");
  //const constraints = { audio: true }
  const constraints = { audio: { deviceId: "default" } };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  console.log(stream);
  let source = audioCtx.createMediaStreamSource(stream);

  const gainNode = audioCtx.createGain();
  source.connect(gainNode);

  const analyser = audioCtx.createAnalyser();
  analyser.minDecibels = -90;
  analyser.maxDecibels = -10;
  analyser.smoothingTimeConstant = 0.85;
  gainNode.connect(analyser);

  analyser.connect(audioCtx.destination);

  /*
  const distortion = audioCtx.createWaveShaper();
  const biquadFilter = audioCtx.createBiquadFilter();
  const convolver = audioCtx.createConvolver();
  source.connect(distortion);
  distortion.connect(biquadFilter);
  biquadFilter.connect(gainNode);
  convolver.connect(gainNode);
  */

  await addOptions();
  audioin.onchange = async () => {
    const deviceId = audioin.value;
    const constraints = { audio: { deviceId } };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log(stream);
    source.disconnect();
    source = audioCtx.createMediaStreamSource(stream);
    //source.connect(distortion);
    source.connect(gainNode);
  };

  //analyser.connect(audioCtx.destination);
  //const constraints2 = { audio: { deviceId: "af959fb1506f0b34ccb81b45dde8d29a1ffa89e6f29184f4dc32e3504801edb0" } }; // microsoft teams
  /*
  const constraints2 = { audio: { deviceId: "dbfdc86597cb327a9a08c61cc465e0cc009b539b775d0fe9bc66d570a33b6181" } };
  const stream2 = await navigator.mediaDevices.getUserMedia(constraints2);
  console.log(stream2);
  const dest = audioCtx.createMediaStreamDestination(stream2);
  analyser.connect(dest);
  */
  //const deviceId = "dbfdc86597cb327a9a08c61cc465e0cc009b539b775d0fe9bc66d570a33b6181"; // speaker
  //const deviceId = "af959fb1506f0b34ccb81b45dde8d29a1ffa89e6f29184f4dc32e3504801edb0"; // teams
  
  const visualize = () => {
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;


    const visualSetting = visualSelect.value;
    console.log(visualSetting);

    if (visualSetting === "sinewave") {
      analyser.fftSize = 2048;
      const bufferLength = analyser.fftSize;
      console.log(bufferLength);
      const dataArray = new Uint8Array(bufferLength);

      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

      const draw = () => {

        drawVisual = requestAnimationFrame(draw);

        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = "rgb(200, 200, 200)";
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = "rgb(0, 0, 0)";

        canvasCtx.beginPath();

        const sliceWidth = WIDTH * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {

          const v = dataArray[i] / 128.0;
          const y = v * HEIGHT / 2;

          if (i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
      };

      draw();

    } else if (visualSetting == "frequencybars") {
      analyser.fftSize = 256;
      const bufferLengthAlt = analyser.frequencyBinCount;
      console.log(bufferLengthAlt);
      const dataArrayAlt = new Uint8Array(bufferLengthAlt);

      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

      const draw = function() {
        drawVisual = requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArrayAlt);

        canvasCtx.fillStyle = "rgb(0, 0, 0)";
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        const barWidth = (WIDTH / bufferLengthAlt) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLengthAlt; i++) {
          barHeight = dataArrayAlt[i];

          canvasCtx.fillStyle = "rgb(" + (barHeight + 100) + ",50,50)";
          canvasCtx.fillRect(x, HEIGHT - barHeight / 2, barWidth, barHeight / 2);

          x += barWidth + 1;
        }
      };

      draw();

    } else if (visualSetting == "off") {
      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
      canvasCtx.fillStyle = "black";
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
    }

  };

  const voiceChange = () => {
    distortion.oversample = "4x";
    biquadFilter.gain.setTargetAtTime(0, audioCtx.currentTime, 0)

    const voiceSetting = voiceSelect.value;
    console.log(voiceSetting);

    //when convolver is selected it is connected back into the audio path
    if (voiceSetting == "convolver") {
      biquadFilter.disconnect(0);
      biquadFilter.connect(convolver);
    } else {
      biquadFilter.disconnect(0);
      biquadFilter.connect(gainNode);

      if (voiceSetting == "distortion") {
        distortion.curve = makeDistortionCurve(400);
      } else if (voiceSetting == "biquad") {
        biquadFilter.type = "lowshelf";
        biquadFilter.frequency.setTargetAtTime(1000, audioCtx.currentTime, 0)
        biquadFilter.gain.setTargetAtTime(25, audioCtx.currentTime, 0)
      } else if (voiceSetting == "off") {
        console.log("Voice settings turned off");
      }
    }
  };

  visualize();

  // event listeners to change visualize and voice settings

  visualSelect.onchange = () => {
    window.cancelAnimationFrame(drawVisual);
    visualize();
  };

  /*
  voiceSelect.onchange = () => {
    voiceChange();
  };
  voiceChange();
  */

  rangegain.onchange = () => {
    gainNode.gain.value = rangegain.value;
  };

  const voiceMute = () => {
    if (mute.id === "") {
      //gainNode.gain.value = 0;
      //gainNode.disconnect();
      analyser.disconnect();
      mute.id = "activated";
      mute.innerHTML = "Unmute";
    } else {
      //gainNode.gain.value = 1;
      //gainNode.connect(audioCtx.destination);
      analyser.connect(audioCtx.destination);
      mute.id = "";
      mute.innerHTML = "Mute";
    }
  };
  mute.onclick = voiceMute;
  //voiceMute();
};

const heading = document.querySelector("h1");
heading.textContent = "CLICK ANYWHERE TO START"
document.body.addEventListener("click", init);
