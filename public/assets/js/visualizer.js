function createVisualizer(){
  if(!window.AudioContext)
  	return

	const sexyColor = '#659593'
	const drawLogo = true

	var player = document.querySelector("audio")
	var canvas = document.querySelector("#vis-canvas")

	function drawCurve(ctx, points){
		ctx.moveTo(points[0].x, points[0].y);
		for (i = 1; i < points.length - 2; i ++){
			var xc = (points[i].x + points[i + 1].x) / 2;
			var yc = (points[i].y + points[i + 1].y) / 2;
			ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
		}
		ctx.quadraticCurveTo(points[i].x, points[i].y, points[i+1].x,points[i+1].y);
	}

	var pts = [];

  function resizeCanvas(){
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
  
  window.addEventListener("resize", resizeCanvas)
  resizeCanvas()

	var ctx = canvas.getContext("2d");

	var analyser;
	var audioCtx = new window.AudioContext()

	analyser = audioCtx.createAnalyser();
	analyser.fftSize = 256 * 64;
	analyser.smoothingTimeConstant = 0.1; // we kinda need shaking to be immediate

	var source = audioCtx.createMediaElementSource(player);

	source.connect(analyser);  // source > analyser > output
	var delay = audioCtx.createDelay();
	delay.delayTime.value = 0.3 // compensate for smoothing time constant
	analyser.connect(delay);
	delay.connect(audioCtx.destination);

	var streamData = new Uint8Array(128 * 64);

	var shakeThreshold = 7000;
	var shakeDelay = 1000;
	var lastShakeTime = 0;

	var totalVol;

	var oldColor = {r: 0, g: 0, b: 0};
	var newColor = {r: 0, g: 0, b: 0};
	var colorTransitionTime = 0;

	var osLogo = new Image();
	osLogo.src = "/assets/img/logo/icon.png";

	function randomDir(){
		var dx = Math.random() - 0.5, dy = Math.random() - 0.5;
		return {x: dx, y: dy};
	}

	var particles = [];

		
	for(var i=0;i<1000;i++){
		particles.push({x: 0, y: 0, z: Math.random() * 10 + 10, dir: randomDir()});
	}

	var lastCalledTime = new Date().getTime();

	var sampleAudioStream = function() {
		if(player.paused){
			canvas.classList.add("hide")
			requestAnimationFrame(sampleAudioStream);
			return;
		} else {
	    canvas.classList.remove("hide")
	  }
		
		var timeNow = new Date().getTime();
		var delta = timeNow - lastCalledTime;
		lastCalledTime = timeNow;
	  
	  var overThresholdPercentage = 1
		
		oldColor = newColor;
		newColor = '#659593'
		colorTransitionTime = 0;

	    analyser.getByteFrequencyData(streamData);
		totalVol = 0;
		for (var i = 0; i < 80; i++) {
			totalVol += Math.pow(streamData[i], 2.72) / 20000;
		}
		
		var offsetX = 0, offsetY = 0;
		
	  overThresholdPercentage = totalVol / shakeThreshold
	  
		if(totalVol > shakeThreshold){
			offsetX = Math.random() * 15 * overThresholdPercentage - 10;
			offsetY = Math.random() * 15 * overThresholdPercentage - 10;
			lastShakeTime = timeNow;
		} else if(timeNow - lastShakeTime < shakeDelay){
			offsetX = Math.random() * 15 - 10;
			offsetY = Math.random() * 15 - 10;
		}
		
	    for (var i = 0; i < 80; i++) {
			var data = Math.pow(streamData[i], 2.72) / 20000;
			if(data < 100) data = 100;
			
			data = data * (canvas.height / 2) / 250;
	        pts[i] = {
				x: (data) * Math.cos(i * Math.PI * 2 / 160 - (Math.PI / 2)) + (canvas.width / 2) + offsetX,
				y: (data) * Math.sin(i * Math.PI * 2 / 160 - (Math.PI / 2)) + (canvas.height / 2) + offsetY
			};
	    }
		
		for (var i = 80; i < 160; i++) {
			var data = Math.pow(streamData[160 - i], 2.72) / 20000;
			if(data < 100) data = 100;
			data = data * (canvas.height / 2) / 250;
	        pts[i] = {
				x: (data) * Math.cos(i * Math.PI * 2 / 160 - (Math.PI / 2)) + (canvas.width / 2) + offsetX,
				y: (data) * Math.sin(i * Math.PI * 2 / 160 - (Math.PI / 2)) + (canvas.height / 2) + offsetY
			};
	    }
		
		for(var i=0;i<particles.length;i++){
			var p = particles[i];
			
			var speed = delta / 1000;
			speed *= overThresholdPercentage * 2
			
			p.x += p.dir.x * speed;
			p.y += p.dir.y * speed;
			p.z -= speed;
		}
	    
	    ctx.clearRect(0, 0, canvas.width, canvas.height);
		
		for(var i=0;i<particles.length;i++){
			var p = particles[i];
			var x = p.x * canvas.width / p.z;
			var y = p.y * canvas.height / p.z;
			var radius = 10 / p.z;
			
			if(Math.abs(x) > canvas.width / 2 || Math.abs(y) > canvas.height / 2 || radius < 0){
				particles[i] = {x: 0, y: 0, z: 10, dir: randomDir()};
				continue;
			}
			
			var gradient = ctx.createRadialGradient(x + canvas.width / 2, y + canvas.height / 2, 0, x + canvas.width / 2, y + canvas.height / 2, radius);
			gradient.addColorStop(0, "gray");
			gradient.addColorStop(0.3, "gray");
			gradient.addColorStop(1, "transparent");
			ctx.fillStyle = gradient;
			
			ctx.beginPath();
			ctx.arc(x + (canvas.width / 2), y + (canvas.height) / 2, radius, 0, Math.PI*2, true); 
			ctx.closePath();
			ctx.fill();
		}

	    ctx.beginPath();
	    drawCurve(ctx, pts);
	    ctx.closePath();
	    ctx.strokeStyle = 'white'
	    ctx.lineWidth = 3;
	    ctx.stroke();
		
		ctx.fillStyle = sexyColor // '#659593'
		ctx.fill();
		
		var targetWidth = 180 * (canvas.height / 2) / 500;
		var targetHeight = osLogo.naturalHeight * targetWidth / osLogo.naturalWidth;
		var logoX = -(targetWidth / 2) + offsetX + (canvas.width / 2);
		var logoY = -(targetHeight / 2) + offsetY + (canvas.height / 2);
		if(drawLogo) ctx.drawImage(osLogo, 0, 0, osLogo.naturalWidth, osLogo.naturalHeight, logoX, logoY, targetWidth, targetHeight);
		requestAnimationFrame(sampleAudioStream);
	};

	requestAnimationFrame(sampleAudioStream);
}

module.exports = createVisualizer
module.exports = createVisualizer