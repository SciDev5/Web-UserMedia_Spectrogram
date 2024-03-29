import Drawer from "./drawer.js";
import Color from "./color.js";

/**@type {Drawer}*/ var spectrogramDrawer;
/**@type {Drawer}*/ var oscilliscopeDrawer;
// /**@type {Drawer}*/ var oscilliscopeDrawer2D;

/**@type {AudioContext}*/ var actx;
/**@type {AnalyserNode}*/ var analyserNode;
/**@type {MediaStreamAudioSourceNode}*/ var micNode;
/**@type {GainNode}*/ var volumeGainNode;
/**@type {AnalyserNode}*/ var analyserNodeLChannel;
/**@type {AnalyserNode}*/ var analyserNodeRChannel;

/**@type {HTMLInputElement}*/ var specGainInput;
/**@type {HTMLInputElement}*/ var specRangeInput;
/**@type {HTMLInputElement}*/ var oscGainInput;
/**@type {HTMLInputElement}*/ var bpmInput;

/**@type {Color}*/ var bgColor = new Color(0x000000);
/**@type {Color[]}*/ var intensityColorMap = [0x020024,0x101358,0x090979,0x023af2,0x0cbbd0,0x0ff486,0xb5eb51,0xfff14b,0xffa369,0xffc0c0,0xffffff].map(v=>new Color(v));



function init() {
    console.log("init");
    spectrogramDrawer = new Drawer(document.getElementById("spectrogram"));
    oscilliscopeDrawer = new Drawer(document.getElementById("oscilliscope"));
    //oscilliscopeDrawer2D = new Drawer(document.getElementById("oscilliscope-2d"));
    specGainInput = document.getElementById("spec-gain-slider");
    specRangeInput = document.getElementById("spec-range-slider");
    oscGainInput = document.getElementById("osc-gain-slider");
    bpmInput = document.getElementById("bpm-input");
}
async function actxInit(e) {
    console.log("init audio");
    removeEventListener("click",actxInit);
    spectrogramDrawer.clearScreenAndTransforms();
    if (!navigator.mediaDevices) {
        alert("Your browser does not support microphone use.");
        return;
    }
    /**@type {MediaStream}*/
    var stream;
    
    try {
        if (confirm("Press OK for microphone, Press CANCEL for screen capture."))
            stream = await navigator.mediaDevices.getUserMedia ({audio: true, video: false})
        else stream = await navigator.mediaDevices.getDisplayMedia({video:true, audio: true})

        //console.log(stream.getTracks().length)
    } catch (e) {
        console.error("Error opening microphone stream:",e);
        alert("Problem opening microphone stream. See console for details.")
    }
    actx = new AudioContext();
    micNode = actx.createMediaStreamSource(stream);
    analyserNode = actx.createAnalyser();
    analyserNode.fftSize = 4096;
    analyserNode.smoothingTimeConstant = 0.2;
    analyserNode.maxDecibels = 40;

    var channelSplitterNode = actx.createChannelSplitter(2);
    analyserNodeLChannel = actx.createAnalyser();
    analyserNodeRChannel = actx.createAnalyser();

    volumeGainNode = actx.createGain();
    volumeGainNode.gain.value = 1;

    micNode.connect(volumeGainNode);
    volumeGainNode.connect(analyserNode)
    volumeGainNode.connect(channelSplitterNode);
    channelSplitterNode.connect(analyserNodeLChannel);
    channelSplitterNode.connect(analyserNodeRChannel);
    //console.log(micNode.channelCount,gain.channelCount)
    console.log(analyserNode);
}

var f = 1;
var t = Date.now(), dt = 0;
var bpm = 120;
function loop() {
    var newT = Date.now(); dt = newT - t; t = newT; bpm = bpmInput.valueAsNumber;
    document.body.style.background = bgColor.hex;

    spectrogramDrawer.clearMatrixStack();
    oscilliscopeDrawer.clearScreenAndTransforms();
    //oscilliscopeDrawer2D.clearScreenAndTransforms();
    var width = spectrogramDrawer.width, height = spectrogramDrawer.height;

    if (actx) {

        const nChunks = 750;
        const chunkRenderSize = height/nChunks;
        const chunkWidth = Math.round(chunkRenderSize * (dt/10));
        spectrogramDrawer.ctx.drawImage(spectrogramDrawer.canvas,-chunkWidth,0);

        var data = getLogFFTData(nChunks,25*f,10000*f);
        var rangeScale = parseFloat(specRangeInput.value), powerScale = parseFloat(specGainInput.value);
        var sortedData = data.map(v=>v).sort(), min = sortedData[0], max = sortedData[data.length-1];
        min = -200+rangeScale; max = 30;
        data = data.map(v=>v+powerScale).map(v=>(v-min)/(max-min));
        for (var i = 0; i < nChunks; i++) {
            //var color = `hsl(${Math.floor(360*data[i])},100%,50%)`;
            //var color = new Color(Math.floor(255*data[i]),Math.floor(255*data[i]),Math.floor(255*data[i])).hex
            var color = getIntensityColor(data[i]).hex;
            if (i < 10) color = (t*bpm/60000)%1 > 0.5?"#ffffff":"#000000"
            spectrogramDrawer.fillRect(width-chunkWidth,height-(i+1)*chunkRenderSize,chunkWidth,chunkRenderSize,color);
        }

        const nSamples = 1000;
        const sampleWidth = width/nSamples;
        var path = getWaveformData(nSamples);
        var oscGain = 10**oscGainInput.value;

        oscilliscopeDrawer.fillRect(0,0,oscilliscopeDrawer.width,oscilliscopeDrawer.height,bgColor.hex);
        var risingEdge = 0; for (var i = 1; i < path[0].length; i++) if (path[0][i-1]<0 && path[0][i]>=0) {risingEdge=i;break;}
        for (var n = 0; n < 1; n++) {
            oscilliscopeDrawer.ctx.beginPath();
            for (var i = 0; i < path[n].length; i++)
                oscilliscopeDrawer.ctx.lineTo((i-risingEdge)*sampleWidth,(-path[n][i]*0.5*oscGain+0.5)*oscilliscopeDrawer.height);
            oscilliscopeDrawer.ctx.strokeStyle = (["#ffffff","#777777","#777777"])[n];
            oscilliscopeDrawer.ctx.lineWidth = 2;
            oscilliscopeDrawer.ctx.stroke();
            oscilliscopeDrawer.ctx.closePath();
        }


        /*
        oscilliscopeDrawer2D.fillRect(0,0,oscilliscopeDrawer.width,oscilliscopeDrawer.height,bgColor.hex);
        oscilliscopeDrawer2D.ctx.beginPath();
        for (var i = 0; i < path[0].length; i++)
            oscilliscopeDrawer2D.ctx.lineTo((path[1][i]*0.5+0.5)*oscilliscopeDrawer2D.width,(path[2][i]*0.5+0.5)*oscilliscopeDrawer2D.height);
        oscilliscopeDrawer2D.ctx.strokeStyle = getIntensityColor(1);
        oscilliscopeDrawer2D.ctx.lineWidth = 2;
        oscilliscopeDrawer2D.ctx.stroke();
        oscilliscopeDrawer2D.ctx.closePath();
        */
        
    } else {
        spectrogramDrawer.ctx.textAlign = "center";
        spectrogramDrawer.ctx.textBaseline = "middle";
        spectrogramDrawer.ctx.font = "50px monospace";
        spectrogramDrawer.clearScreen();
        spectrogramDrawer.fillRect(0,0,width,height,bgColor.hex);
        spectrogramDrawer.ctx.fillStyle = "#ffffff";
        spectrogramDrawer.ctx.fillText("CLICK ANYWHERE TO START",width/2,height/2,width*0.8);

        for (var i = 0; i < height; i++) {
            var color = getIntensityColor(i/(height-1)).hex;
            spectrogramDrawer.fillRect(width-20,height-(i+1),20,1,color);
        }
    }
}



// ------------- Math Utilities ------------- //


/**
 * Generate a ranfom number between `min` (inclusive) and `max` (exclusive).
 * @param {number} min [INT] The minimum value for the rng (inclusive).
 * @param {number} max [INT] The maximum value for the rng (exclusive).
 * @returns {number} A random integer between min and max.
 */
function randInt(min,max) { return Math.floor((max-min)*Math.random())+min; }


function getLogFFTData(nDivs,fMin,fMax,dolog) {
    /*
    var logData = new Float32Array(nDivs).fill(0);
    analyserNode.getFloatFrequencyData(logData);
    return logData;
    //*/

    var fMinFac = Math.log(fMin/actx.sampleRate), fMaxFac = Math.log(fMax/actx.sampleRate);
    var linearDivs = analyserNode.frequencyBinCount*4;
    var linearData = new Float32Array(linearDivs);
    analyserNode.getFloatFrequencyData(linearData);
    var logData = new Float32Array(nDivs).fill(0);

    
    
    for (var i = 1; i < linearData.length; i++) {
        var binLower = (Math.log((i)/linearDivs)-fMinFac)/(fMaxFac-fMinFac)*nDivs;
        var binUpper = (Math.log((i+1)/linearDivs)-fMinFac)/(fMaxFac-fMinFac)*nDivs;
        var d = binUpper-binLower;
        if (dolog) console.log(i,binLower)

        if (Math.floor(binLower) == Math.floor(binUpper)) {
            logData[Math.floor(binLower)] += linearData[i]*d;
        } else {
            for (var j = Math.ceil(binLower); j < Math.floor(binUpper); j++) {
                var k = (j-binLower)/d;
                logData[j] = (1-k)*linearData[i]+k*linearData[i+1];
            }
            
            logData[Math.floor(binLower)] += linearData[i]*(Math.floor(binLower)-binLower+1);
            logData[Math.floor(binUpper)] += linearData[i+1]*(binUpper-Math.floor(binUpper));
        }
    }
    

    var minValue = logData.filter(v=>v!=0).sort(); minValue=minValue[0];
    return logData.map(v=>v==0?minValue:v);
}
function getWaveformData(nSamples) {
    var dataC = new Float32Array(nSamples), dataL = new Float32Array(nSamples), dataR = new Float32Array(nSamples);
    analyserNode.getFloatTimeDomainData(dataC);
    analyserNodeLChannel.getFloatTimeDomainData(dataL);
    analyserNodeRChannel.getFloatTimeDomainData(dataR);
    return [dataC,dataL,dataR];
}

function getIntensityColor(fac) {
    var k = Math.max(0,Math.min(1,fac));
    var h = (0.6-0.75*k**4+1)%1;
    var s = 1-k**7;
    var v = k**0.7;
    return Color.hsv(h,s,v);
}

// ------------- Events ------------- //

addEventListener("load",init);
addEventListener("click",actxInit);
setInterval(loop,10);