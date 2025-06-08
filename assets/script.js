    // Difficulty and speed mapping
    const DIFFICULTY_SPEEDS = {
      easy: 3,
      normal: 4,
      hard: 6
    };
    let currentDifficulty = 'normal';
    let SPEED = DIFFICULTY_SPEEDS[currentDifficulty];
    // Unique high score key for each difficulty
    const DIFFICULTY_HIGH_SCORE_KEYS = {
      easy: "astralore_high_score_easy",
      normal: "astralore_high_score_normal",
      hard: "astralore_high_score_hard"
    };
    // The high score for the current difficulty
    let highScore = Number(localStorage.getItem(DIFFICULTY_HIGH_SCORE_KEYS[currentDifficulty])) || 0;
    const highScorePopup = document.getElementById('highScorePopup');
    function getHighScoreKey() {
      return DIFFICULTY_HIGH_SCORE_KEYS[currentDifficulty];
    }
    function getHighScoreLabel() {
      if (currentDifficulty === "easy") return "Easy High Score";
      if (currentDifficulty === "hard") return "Hard High Score";
      return "Normal High Score";
    }
    function updateHighScoreDisplay() {
      highScorePopup.textContent = getHighScoreLabel() + ": " + (highScore || "0");
    }
    updateHighScoreDisplay();

    // Menu logic for settings and play
    const menuScreen = document.getElementById('menuScreen');
    const playBtn = document.getElementById('playBtn');
    const menuSettingsBtn = document.getElementById('menuSettingsBtn');
    const gameContainer = document.getElementById('container');
    const homeBgVideo = document.getElementById('homeBgVideo');

    playBtn.onclick = function() {
      menuScreen.style.display = "none";
      gameContainer.style.display = "flex";
      homeBgVideo.style.opacity = "0";
      resetGame();
    };
    menuSettingsBtn.onclick = function() {
      document.getElementById('settingsModal').style.display = "flex";
    };

    // Show menu/video again if user refreshes or returns to menu (optional)
    function showHomeMenu() {
      menuScreen.style.display = "flex";
      gameContainer.style.display = "none";
      homeBgVideo.style.opacity = "0.84";
    }

    // Settings modal logic
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const volumeRange = document.getElementById('volumeRange');
    const volumeValue = document.getElementById('volumeValue');
    const difficultySelect = document.getElementById('difficultySelect');
    closeSettingsBtn.onclick = function() {
      settingsModal.style.display = "none";
    };
    volumeRange.oninput = function() {
      volumeValue.textContent = volumeRange.value;
    };
    difficultySelect.onchange = function() {
      currentDifficulty = difficultySelect.value;
      SPEED = DIFFICULTY_SPEEDS[currentDifficulty];
      highScore = Number(localStorage.getItem(getHighScoreKey())) || 0;
      updateHighScoreDisplay();
    };

    // --- Terms modal logic with localStorage ---
    const modal = document.getElementById('termsModal');
    const acceptBtn = document.getElementById('acceptBtn');
    let termsAccepted = localStorage.getItem('astralore_terms_accepted') === 'true';
    function acceptTerms() {
      modal.style.display = 'none';
      gameContainer.style.filter = '';
      gameContainer.style.pointerEvents = '';
      menuScreen.style.filter = '';
      menuScreen.style.pointerEvents = '';
      localStorage.setItem('astralore_terms_accepted', 'true');
      termsAccepted = true;
    }
    acceptBtn.onclick = acceptTerms;
    if (termsAccepted) {
      modal.style.display = 'none';
      gameContainer.style.filter = '';
      gameContainer.style.pointerEvents = '';
      menuScreen.style.filter = '';
      menuScreen.style.pointerEvents = '';
    } else {
      modal.style.display = 'flex';
      menuScreen.style.filter = 'blur(2.5px)';
      menuScreen.style.pointerEvents = 'none';
      gameContainer.style.filter = 'blur(2.5px)';
      gameContainer.style.pointerEvents = 'none';
    }

    // --- FULLSCREEN LOGIC, HIGH RESOLUTION CANVAS ---
    const VIRTUAL_WIDTH = 640;
    const VIRTUAL_HEIGHT = 320;
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    function isFullscreen() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }
    function fitCanvasToContainer() {
      let width, height;
      if (isFullscreen()) {
        width = window.innerWidth;
        height = window.innerHeight;
      } else {
        const containerRect = gameContainer.getBoundingClientRect();
        width = containerRect.width;
        height = containerRect.height;
        const aspect = VIRTUAL_WIDTH / VIRTUAL_HEIGHT;
        if (width / height > aspect) width = height * aspect;
        else height = width / aspect;
      }
      const ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
    }
    function resizeAll() {
      fitCanvasToContainer();
      if (isFullscreen()) fullscreenBtn.classList.add('hide');
      else fullscreenBtn.classList.remove('hide');
    }
    fullscreenBtn.onclick = () => {
      if (gameContainer.requestFullscreen) gameContainer.requestFullscreen();
      else if (gameContainer.webkitRequestFullscreen) gameContainer.webkitRequestFullscreen();
      else if (gameContainer.msRequestFullscreen) gameContainer.msRequestFullscreen();
    };
    document.addEventListener('fullscreenchange', resizeAll);
    window.addEventListener('resize', resizeAll);
    resizeAll();

    // --- GAME LOGIC ---
    const PLAYER_SIZE = 32;
    const PLAYER_X = 100;
    const GRAVITY = 0.5;
    const GROUND_HEIGHT = 44;

    // Super fly logic (5s duration, 5s cooldown)
    let superFlyAvailable = true;
    let lastSuperFlyTime = 0;
    let superFlyActive = false;
    let superFlyStartTime = 0;
    const SUPER_FLY_DURATION = 5000;
    const SUPER_FLY_COOLDOWN = 5000;

    // Flying animation (sinusoidal) during super fly
    let flyingY = null;
    let flyOscillation = 0;

    // Spin logic
    let spinAngle = 0;

    // Obstacle pattern state for double obstacle timing
    let hasFirstCheckpointAppeared = false;
    let lastDoubleObstacleTime = null;

    // For random obstacle generation, but always playable!
    const MIN_OBSTACLE_DIST = 220;
    const MAX_OBSTACLE_DIST = 340;
    const possibleSizes = [38, 70];

    function getRightmostObstacleX() {
      let rightmostX = 0;
      for (let obs of obstacles) {
        if (obs.x > rightmostX) rightmostX = obs.x;
      }
      return rightmostX;
    }

    function generatePlayableObstacle(prevObstacle) {
      const size = possibleSizes[Math.floor(Math.random() * possibleSizes.length)];
      let minX = prevObstacle ? prevObstacle.x + MIN_OBSTACLE_DIST : VIRTUAL_WIDTH + 280;
      let maxX = prevObstacle ? prevObstacle.x + MAX_OBSTACLE_DIST : VIRTUAL_WIDTH + 340;
      if (prevObstacle && prevObstacle.size === 70 && size === 70) {
        minX += 20;
        maxX += 40;
      }
      const x = Math.floor(Math.random() * (maxX - minX + 1)) + minX;
      return {
        type: 'triangle',
        x: x,
        y: VIRTUAL_HEIGHT - GROUND_HEIGHT,
        size: size
      };
    }

    function spawnDoubleTriangleObstacle() {
      const x1 = getRightmostObstacleX() + 80;
      const x2 = x1 + 120;
      const groundY = VIRTUAL_HEIGHT - GROUND_HEIGHT;
      obstacles.push({
        type: 'triangle',
        x: x1,
        y: groundY,
        size: 38
      });
      obstacles.push({
        type: 'triangle',
        x: x2,
        y: groundY,
        size: 70
      });
    }

    function onFirstCheckpoint() {
      hasFirstCheckpointAppeared = true;
      lastDoubleObstacleTime = Date.now();
    }

    const bgImg = new Image();
    bgImg.src = 'images/bg.jpg';
    let bgLoaded = false;
    bgImg.onload = () => { bgLoaded = true; };

    const heroImg = new Image();
    heroImg.src = 'images/hero.png';
    let heroLoaded = false;
    heroImg.onload = () => { heroLoaded = true; };

    const gameOverDiv = document.getElementById('gameOver');
    const restartBtn = document.getElementById('restartBtn');

    let player, obstacles, gameOver, score;
    let animationFrame;

    function resetGame() {
      SPEED = DIFFICULTY_SPEEDS[currentDifficulty];
      highScore = Number(localStorage.getItem(getHighScoreKey())) || 0;
      updateHighScoreDisplay();
      player = {
        x: PLAYER_X,
        y: VIRTUAL_HEIGHT - GROUND_HEIGHT - PLAYER_SIZE,
        vy: 0
      };
      obstacles = [];
      let startX = 400;
      let prev = null;
      for (let i = 0; i < 4; i++) {
        let obs = {
          type: 'triangle',
          x: startX + i * 280,
          y: VIRTUAL_HEIGHT - GROUND_HEIGHT,
          size: possibleSizes[Math.floor(Math.random() * possibleSizes.length)]
        };
        obstacles.push(obs);
        prev = obs;
      }
      gameOver = false;
      score = 0;
      gameOverDiv.style.display = 'none';

      superFlyAvailable = true;
      lastSuperFlyTime = 0;
      superFlyActive = false;
      superFlyStartTime = 0;
      flyingY = null;
      flyOscillation = 0;

      hasFirstCheckpointAppeared = false;
      lastDoubleObstacleTime = null;
      spinAngle = 0;

      cancelAnimationFrame(animationFrame);
      loop();
    }

    function drawScore() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const fontSize = Math.round(canvas.height / 18);
      ctx.font = `bold ${fontSize}px Montserrat, Arial, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillStyle = "#232323";
      ctx.globalAlpha = 0.95;
      ctx.textAlign = "left";
      ctx.fillText(`Score: ${score}`, 18 * (canvas.width / VIRTUAL_WIDTH), 9 * (canvas.height / VIRTUAL_HEIGHT));
      ctx.textAlign = "right";
      ctx.fillText(getHighScoreLabel() + ": " + highScore, canvas.width - 18 * (canvas.width / VIRTUAL_WIDTH), 9 * (canvas.height / VIRTUAL_HEIGHT));
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function drawPlayer() {
      const scaleX = canvas.width / VIRTUAL_WIDTH;
      const scaleY = canvas.height / VIRTUAL_HEIGHT;
      ctx.save();
      ctx.scale(scaleX, scaleY);

      if (heroLoaded) {
        ctx.save();
        ctx.translate(player.x + PLAYER_SIZE/2, player.y + PLAYER_SIZE/2);
        ctx.rotate(spinAngle);
        ctx.drawImage(heroImg, -PLAYER_SIZE/2, -PLAYER_SIZE/2, PLAYER_SIZE, PLAYER_SIZE);
        ctx.restore();
      } else {
        ctx.fillStyle = '#00e0c6';
        ctx.fillRect(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE);
      }
      ctx.restore();
    }

    function drawObstacles() {
      const scaleX = canvas.width / VIRTUAL_WIDTH;
      const scaleY = canvas.height / VIRTUAL_HEIGHT;
      ctx.save();
      ctx.scale(scaleX, scaleY);
      obstacles.forEach(obs => {
        if (obs.type === 'triangle') {
          drawGlowingTriangle(obs.x, obs.y, obs.size);
        }
      });
      ctx.restore();
    }

    function drawGlowingTriangle(cx, baseY, size) {
      const height = size * Math.sqrt(3) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, baseY - height);
      ctx.lineTo(cx - size / 2, baseY);
      ctx.lineTo(cx + size / 2, baseY);
      ctx.closePath();
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#0a0015";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#e34cff";
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.restore();
    }

    function checkCollision() {
      if (superFlyActive) return false;
      for (let obs of obstacles) {
        if (obs.type === 'triangle') {
          let px = player.x, py = player.y, ps = PLAYER_SIZE;
          let cx = obs.x, baseY = obs.y, size = obs.size;
          let h = size * Math.sqrt(3) / 2;
          let tri = [
            {x: cx, y: baseY - h},
            {x: cx - size/2, y: baseY},
            {x: cx + size/2, y: baseY}
          ];
          let playerBox = {left: px, top: py, right: px+ps, bottom: py+ps};
          let triBox = {
            left: cx - size/2,
            right: cx + size/2,
            top: baseY - h,
            bottom: baseY
          };
          if (playerBox.right < triBox.left || playerBox.left > triBox.right ||
              playerBox.bottom < triBox.top || playerBox.top > triBox.bottom) {
            continue;
          }
          let corners = [
            {x: px, y: py},
            {x: px+ps, y: py},
            {x: px, y: py+ps},
            {x: px+ps, y: py+ps}
          ];
          for (let c of corners) {
            if (pointInTriangle(c, tri[0], tri[1], tri[2])) {
              return true;
            }
          }
        }
      }
      return false;
    }

    function pointInTriangle(p, a, b, c) {
      function sign(p1, p2, p3) {
        return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
      }
      let d1 = sign(p, a, b);
      let d2 = sign(p, b, c);
      let d3 = sign(p, c, a);
      let has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
      let has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
      return !(has_neg && has_pos);
    }

    function drawGround() {
      const scaleX = canvas.width / VIRTUAL_WIDTH;
      const scaleY = canvas.height / VIRTUAL_HEIGHT;
      ctx.save();
      ctx.scale(scaleX, scaleY);
      ctx.fillStyle = "#33394f";
      ctx.fillRect(0, VIRTUAL_HEIGHT - GROUND_HEIGHT, VIRTUAL_WIDTH, GROUND_HEIGHT);
      ctx.restore();
    }

    function drawSuperFlyIndicator() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const fontSize = Math.round(canvas.height / 28);
      ctx.font = `bold ${fontSize}px Montserrat, Arial, sans-serif`;
      ctx.textBaseline = "bottom";
      ctx.textAlign = "left";
      let msg = "";
      if (superFlyActive) {
        const remaining = Math.max(0, Math.ceil((SUPER_FLY_DURATION - (Date.now() - superFlyStartTime))/1000));
        ctx.fillStyle = "#00e0c6";
        msg = `Super Fly: FLYING! (${remaining}s) - Press T again to stop`;
      } else if (superFlyAvailable) {
        ctx.fillStyle = "#00e0c6";
        msg = "Super Fly: READY! (T)";
      } else {
        ctx.fillStyle = "#00e0c6";
        const remaining = Math.max(0, 5 - Math.floor((Date.now() - lastSuperFlyTime)/1000));
        msg = `Super Fly: ${remaining}s`;
      }
      const x = 18 * (canvas.width / VIRTUAL_WIDTH);
      const y = canvas.height - 12 * (canvas.height / VIRTUAL_HEIGHT);
      ctx.globalAlpha = 0.96;
      ctx.fillText(msg, x, y);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function updatePlayer() {
      if (superFlyActive) {
        let skyY = VIRTUAL_HEIGHT * 0.25;
        if (flyingY === null) {
          flyingY = skyY;
          flyOscillation = 0;
        }
        flyOscillation += 0.13;
        player.vy = 0;
        player.y = flyingY + Math.sin(flyOscillation) * 28;
        spinAngle += 0.25;
      } else {
        player.vy += GRAVITY;
        player.y += player.vy;
        if (!isOnFloor()) {
          spinAngle += 0.25;
        } else {
          player.y = VIRTUAL_HEIGHT - GROUND_HEIGHT - PLAYER_SIZE;
          player.vy = 0;
          spinAngle = 0;
        }
      }
    }

    function isOnFloor() {
      return player.y + PLAYER_SIZE >= VIRTUAL_HEIGHT - GROUND_HEIGHT;
    }

    function jump(strength) {
      if (isOnFloor() && !superFlyActive) {
        player.vy = strength;
      }
    }

    function trySuperFly() {
      if (superFlyAvailable && !superFlyActive) {
        superFlyActive = true;
        superFlyAvailable = false;
        superFlyStartTime = Date.now();
        lastSuperFlyTime = Date.now();
        flyingY = VIRTUAL_HEIGHT * 0.25;
        flyOscillation = 0;
        player.y = flyingY;
        player.vy = 0;
      }
    }

    function updateSuperFly() {
      if (superFlyActive) {
        if (Date.now() - superFlyStartTime >= SUPER_FLY_DURATION) {
          superFlyActive = false;
          lastSuperFlyTime = Date.now();
        }
      } else {
        if (!superFlyAvailable && Date.now() - lastSuperFlyTime >= SUPER_FLY_COOLDOWN) {
          superFlyAvailable = true;
        }
      }
    }

    function updateObstacles() {
      for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.x -= SPEED;
        if ((obs.type === 'triangle' && obs.x + obs.size/2 < 0)) {
          let rightmostX = getRightmostObstacleX();
          let prevObstacle = { x: rightmostX, size: obs.size };
          obstacles[i] = generatePlayableObstacle(prevObstacle);
          score++;
        }
      }
      if (hasFirstCheckpointAppeared && lastDoubleObstacleTime !== null) {
        if (Date.now() - lastDoubleObstacleTime >= 10000) {
          spawnDoubleTriangleObstacle();
          lastDoubleObstacleTime = Date.now();
        }
      }
    }

    function loop() {
      resizeAll();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (bgLoaded) {
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
      }

      drawGround();
      drawObstacles();
      drawPlayer();
      drawScore();
      drawSuperFlyIndicator();

      updatePlayer();
      updateObstacles();
      updateSuperFly();

      if (!hasFirstCheckpointAppeared && performance.now() > 8000) {
        onFirstCheckpoint();
      }

      if (checkCollision()) {
        gameOver = true;
        gameOverDiv.style.display = 'block';
        // Save high score for this difficulty
        if (score > highScore) {
          highScore = score;
          localStorage.setItem(getHighScoreKey(), highScore);
        }
        updateHighScoreDisplay();
        return;
      }

      animationFrame = requestAnimationFrame(loop);
    }

    window.addEventListener('keydown', e => {
      if (gameContainer.style.display === "none") return;
      if (e.code === 'Space') {
        jump(-12);
        if (gameOver) resetGame();
      }
      if (e.code === 'KeyT') {
        if (superFlyActive) {
          superFlyActive = false;
          lastSuperFlyTime = Date.now();
        } else {
          trySuperFly();
        }
      }
    });

    restartBtn.onclick = () => resetGame();