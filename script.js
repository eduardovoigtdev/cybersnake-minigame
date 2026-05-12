        // configs canvas + contexto
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        
        // elementos interface
        const scoreEl = document.getElementById('score');
        const highScoreEl = document.getElementById('highScore');
        const finalScoreEl = document.getElementById('finalScore');
        const screenStart = document.getElementById('screen-start');
        const screenGameOver = document.getElementById('screen-gameover');
        const screenPause = document.getElementById('screen-pause');

        // configs jogo
        const gridSize = 20;
        const tileCount = canvas.width / gridSize;
        let animationId;
        let lastTime = 0;
        
        // stats jogo
        let state = 'START'; // START, PLAYING, PAUSED, GAMEOVER
        let score = 0;
        let highScore = localStorage.getItem('neonSnakeHighScore') || 0;
        highScoreEl.innerText = highScore;

        // entidades
        let snake = [];
        let snakeLength = 3;
        let velocity = { x: 0, y: 0 };
        let nextVelocity = { x: 0, y: 0 };
        let food = { x: 0, y: 0 };
        let particles = [];
        
        // controle velocidade
        let speedConfig = {
            baseDelay: 150,
            minDelay: 50,
            currentDelay: 150,
            timer: 0
        };

        // sistema audio nativo
        let audioCtx;
        function initAudio() {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        }

        function playSound(type) {
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            const now = audioCtx.currentTime;
            if (type === 'eat') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'die') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                osc.start(now);
                osc.stop(now + 0.4);
            }
        }

        // sistema particulas
        class Particle {
            constructor(x, y, color) {
                this.x = x * gridSize + gridSize / 2;
                this.y = y * gridSize + gridSize / 2;
                this.vx = (Math.random() - 0.5) * 10;
                this.vy = (Math.random() - 0.5) * 10;
                this.life = 1;
                this.decay = Math.random() * 0.05 + 0.02;
                this.color = color;
                this.size = Math.random() * 4 + 2;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.life -= this.decay;
            }
            draw(ctx) {
                ctx.globalAlpha = Math.max(0, this.life);
                ctx.fillStyle = this.color;
                ctx.shadowBlur = 10;
                ctx.shadowColor = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;
            }
        }

        function createExplosion(x, y, color, amount) {
            for (let i = 0; i < amount; i++) {
                particles.push(new Particle(x, y, color));
            }
        }

        function spawnFood() {
            let valid = false;
            while (!valid) {
                food.x = Math.floor(Math.random() * tileCount);
                food.y = Math.floor(Math.random() * tileCount);
                valid = !snake.some(segment => segment.x === food.x && segment.y === food.y);
            }
        }

        // inicialização jogo
        function initGame() {
            initAudio();
            
            snake = [
                { x: 10, y: 10 },
                { x: 10, y: 11 },
                { x: 10, y: 12 }
            ];
            snakeLength = 3;
            velocity = { x: 0, y: -1 };
            nextVelocity = { x: 0, y: -1 };
            score = 0;
            speedConfig.currentDelay = speedConfig.baseDelay;
            particles = [];
            
            scoreEl.innerText = score;
            spawnFood();
            
            state = 'PLAYING';
            screenStart.classList.remove('active');
            screenGameOver.classList.remove('active');
            screenPause.classList.remove('active');

            // reset visual tela
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.style.boxShadow = "0 0 15px var(--neon-cyan), inset 0 0 15px var(--neon-cyan)";
            
            if (!animationId) {
                lastTime = performance.now();
                animationId = requestAnimationFrame(gameLoop);
            }
        }

        function togglePause() {
            if (state === 'PLAYING') {
                state = 'PAUSED';
                screenPause.classList.add('active');
            } else if (state === 'PAUSED') {
                state = 'PLAYING';
                screenPause.classList.remove('active');
                lastTime = performance.now(); // Prevenir salto tempo
                requestAnimationFrame(gameLoop);
            }
        }

        function gameOver() {
            state = 'GAMEOVER';
            playSound('die');
            
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('neonSnakeHighScore', highScore);
                highScoreEl.innerText = highScore;
            }
            
            finalScoreEl.innerText = score;
            screenGameOver.classList.add('active');
            createExplosion(snake[0].x, snake[0].y, '#ff007f', 30);
            
            // efeito visual borda canvas
            canvas.style.boxShadow = "0 0 30px var(--neon-pink), inset 0 0 30px var(--neon-pink)";
            
            // render frame final morte
            draw();
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        // lógica att
        function updateLogic() {
            velocity = { ...nextVelocity };
            
            const head = { 
                x: snake[0].x + velocity.x, 
                y: snake[0].y + velocity.y 
            };

            // colisão paredes
            if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
                return gameOver();
            }

            // colisão corpo
            if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
                return gameOver();
            }

            snake.unshift(head);

            // colisão comida
            if (head.x === food.x && head.y === food.y) {
                score += 10;
                scoreEl.innerText = score;
                playSound('eat');
                createExplosion(food.x, food.y, '#39ff14', 15);
                spawnFood();
                
                // aumentar velocidade
                if (speedConfig.currentDelay > speedConfig.minDelay) {
                    speedConfig.currentDelay -= 2;
                }
            } else {
                snake.pop();
            }
        }

        // loop principal
        function gameLoop(timestamp) {
            if (state !== 'PLAYING') return;

            const deltaTime = timestamp - lastTime;
            lastTime = timestamp;

            // att independente partículas (fluidez)
            particles.forEach(p => p.update());
            particles = particles.filter(p => p.life > 0);

            // controle tick cobra
            speedConfig.timer += deltaTime;
            if (speedConfig.timer >= speedConfig.currentDelay) {
                updateLogic();
                speedConfig.timer = 0;
            }

            if (state === 'PLAYING') {
                draw();
                animationId = requestAnimationFrame(gameLoop);
            }
        }

        // render
        function draw() {
            // fundo semitransparente rastro
            ctx.fillStyle = 'rgba(5, 5, 5, 0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // render comida
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#39ff14';
            ctx.fillStyle = '#39ff14';
            ctx.beginPath();
            const foodCenterX = food.x * gridSize + gridSize / 2;
            const foodCenterY = food.y * gridSize + gridSize / 2;
            ctx.arc(foodCenterX, foodCenterY, gridSize / 2.5, 0, Math.PI * 2);
            ctx.fill();

            // render cobra
            snake.forEach((segment, index) => {
                const isHead = index === 0;
                
                // estilo neon (cabeça vs corpo)
                ctx.fillStyle = isHead ? '#00ffff' : 'rgba(0, 255, 255, 0.7)';
                ctx.shadowBlur = isHead ? 20 : 5;
                ctx.shadowColor = '#00ffff';
                
                // margem interna divisão segmentos
                const padding = isHead ? 0 : 2;
                
                // arredondamento formato
                ctx.beginPath();
                ctx.roundRect(
                    segment.x * gridSize + padding, 
                    segment.y * gridSize + padding, 
                    gridSize - (padding * 2), 
                    gridSize - (padding * 2), 
                    isHead ? 6 : 4
                );
                ctx.fill();
            });

            // reset blur particulas
            ctx.shadowBlur = 0;
            particles.forEach(p => p.draw(ctx));
        }

        // input setup (controle pc)
        window.addEventListener('keydown', e => {
            switch(e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    if (velocity.y !== 1) nextVelocity = { x: 0, y: -1 };
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    if (velocity.y !== -1) nextVelocity = { x: 0, y: 1 };
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    if (velocity.x !== 1) nextVelocity = { x: -1, y: 0 };
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    if (velocity.x !== -1) nextVelocity = { x: 1, y: 0 };
                    break;
                case ' ':
                    e.preventDefault();
                    if (state === 'START' || state === 'GAMEOVER') {
                        initGame();
                    } else if (state === 'PLAYING' || state === 'PAUSED') {
                        togglePause();
                    }
                    break;
                case 'Escape':
                    if (state === 'PLAYING' || state === 'PAUSED') togglePause();
                    break;
            }
        });

        // input setup (controles celular)
        const setupMobileControl = (id, nx, ny, vx_not, vy_not) => {
            const btn = document.getElementById(id);
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault(); // evitar zoom de dois toques
                if (velocity.x !== vx_not && velocity.y !== vy_not) {
                    nextVelocity = { x: nx, y: ny };
                }
            });
            btn.addEventListener('mousedown', (e) => {
                if (velocity.x !== vx_not && velocity.y !== vy_not) {
                    nextVelocity = { x: nx, y: ny };
                }
            });
        };

        setupMobileControl('btn-up', 0, -1, 0, 1);
        setupMobileControl('btn-down', 0, 1, 0, -1);
        setupMobileControl('btn-left', -1, 0, 1, 0);
        setupMobileControl('btn-right', 1, 0, -1, 0);

        // render inicial silencioso grid vazio
        draw();
