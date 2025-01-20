document.addEventListener('DOMContentLoaded', function() {
    // 전역 변수 설정
    let isRunning = false;
    let currentCycle = 0;
    let totalCycles = 10;
    let timer = null;
    let stream = null;

    // DOM 요소
    const readyBtn = document.getElementById('readyBtn');
    const startBtn = document.getElementById('startBtn');
    const instruction = document.getElementById('instruction');
    const timer_display = document.getElementById('timer');
    const progress = document.getElementById('progress');
    const currentCycleDisplay = document.getElementById('currentCycle');
    const totalCyclesDisplay = document.getElementById('totalCycles');
    const cycleCountInput = document.getElementById('cycleCount');
    const saveSettingsBtn = document.getElementById('saveSettings');
    const video = document.getElementById('webcam');

    // 호흡 단계 설정
    const breathingPhases = [
        { text: '세상에 모든 공기를 내가 다 마시겠다는 생각으로 숨을 들이마셔 주세요.', time: 7 },
        { text: '횡격막 쪽에 자극을 느끼며 숨을 참아 주세요.', time: 5 },
        { text: '몸 안에 숨이 하나도 안 남을 정도로 토해내 주세요.', time: 7 },
        { text: '횡격막 쪽에 자극을 느끼며 숨을 참아 주세요.', time: 5 },
        { text: '잠시 쉬어주세요.', time: 3 }
    ];

    // 이벤트 리스너 설정
    readyBtn.onclick = initCamera;
    startBtn.onclick = toggleExercise;
    saveSettingsBtn.onclick = updateSettings;

    // 카메라 초기화
    async function initCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: false 
            });
            video.srcObject = stream;
            readyBtn.style.display = 'none';
            startBtn.style.display = 'block';
            instruction.textContent = '자세를 잡고 호흡 준비를 해 주세요.';
        } catch (err) {
            console.error('카메라 오류:', err);
            alert('카메라를 시작할 수 없습니다. 카메라 권한을 확인해주세요.');
        }
    }

    // 설정 업데이트
    function updateSettings() {
        const newCount = parseInt(cycleCountInput.value);
        if (newCount > 0 && newCount <= 20) {
            totalCycles = newCount;
            totalCyclesDisplay.textContent = newCount;
        } else {
            alert('반복 횟수는 1~20 사이로 설정해주세요.');
            cycleCountInput.value = totalCycles;
        }
    }

    // 운동 시작/중지 토글
    function toggleExercise() {
        if (!isRunning) {
            startExercise();
        } else {
            stopExercise();
        }
    }

    // 운동 시작
    function startExercise() {
        isRunning = true;
        startBtn.textContent = '중지';
        startBreathingCycle();
    }

    // 운동 중지
    function stopExercise() {
        isRunning = false;
        startBtn.textContent = '시작하기';
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        resetUI();
    }

    // 호흡 사이클 시작
    function startBreathingCycle() {
        let phaseIndex = 0;
        let timeLeft = breathingPhases[0].time;
        
        function updateTimer() {
            instruction.textContent = breathingPhases[phaseIndex].text;
            timer_display.textContent = `00:${String(timeLeft).padStart(2, '0')}`;
            
            const totalTime = breathingPhases.reduce((sum, phase) => sum + phase.time, 0);
            const elapsedTime = breathingPhases.slice(0, phaseIndex).reduce((sum, phase) => sum + phase.time, 0) 
                + (breathingPhases[phaseIndex].time - timeLeft);
            const progressWidth = (elapsedTime / totalTime) * 100;
            progress.style.width = `${progressWidth}%`;
            
            timeLeft--;

            if (timeLeft < 0) {
                phaseIndex++;
                if (phaseIndex >= breathingPhases.length) {
                    completeCycle();
                    phaseIndex = 0;
                }
                timeLeft = breathingPhases[phaseIndex].time;
            }
        }

        updateTimer();
        timer = setInterval(updateTimer, 1000);
    }

    // 사이클 완료
    function completeCycle() {
        currentCycle++;
        currentCycleDisplay.textContent = currentCycle;
        
        if (currentCycle >= totalCycles) {
            alert('모든 사이클이 완료되었습니다!');
            stopExercise();
            currentCycle = 0;
            currentCycleDisplay.textContent = '0';
        }
    }

    // UI 초기화
    function resetUI() {
        timer_display.textContent = '00:00';
        progress.style.width = '0%';
        instruction.textContent = '자세를 잡고 호흡 준비를 해 주세요.';
    }
});
