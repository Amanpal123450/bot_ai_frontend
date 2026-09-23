import { useEffect, useState } from "react";

const styles = `
.kiko-stage {
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
}

/* =====================================================
   CHARACTER
===================================================== */

.kiko-char-wrap {
  width: 390px;
  height: 520px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

#kiko-elephant {
  width: 100%;
  height: 100%;
  overflow: visible;
  transform-origin: 50% 85%;
}

/* =====================================================
   IDLE BREATHING
===================================================== */

#kiko-body-group {
  transform-origin: 150px 350px;
  animation: kiko-breathe 3s ease-in-out infinite;
}

@keyframes kiko-breathe {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }

  50% {
    transform: translateY(-2px) scale(1.012);
  }
}

/* =====================================================
   EARS
===================================================== */

#kiko-ear-left {
  transform-box: fill-box;
  transform-origin: center;
  animation: ear-left 4s ease-in-out infinite;
}

#kiko-ear-right {
  transform-box: fill-box;
  transform-origin: center;
  animation: ear-right 4s ease-in-out infinite;
}

@keyframes ear-left {
  0%,
  100% {
    transform: rotate(0deg);
  }

  50% {
    transform: rotate(2deg);
  }
}

@keyframes ear-right {
  0%,
  100% {
    transform: rotate(0deg);
  }

  50% {
    transform: rotate(-2deg);
  }
}

/* =====================================================
   BLINK
===================================================== */

#kiko-eye-left,
#kiko-eye-right {
  transform-box: fill-box;
  transform-origin: center;
}

.kiko-blink #kiko-eye-left,
.kiko-blink #kiko-eye-right {
  animation: blink 0.14s ease-in-out;
}

@keyframes blink {
  0%,
  100% {
    transform: scaleY(1);
  }

  50% {
    transform: scaleY(0.08);
  }
}

/* =====================================================
   HEART
===================================================== */

#kiko-heart {
  transform-box: fill-box;
  transform-origin: center;
  animation: heartBeat 2s ease-in-out infinite;
}

@keyframes heartBeat {
  0%,
  100% {
    transform: translate(0, 20px) scale(1);
  }

  30% {
    transform: translate(0, 20px) scale(1.08);
  }

  45% {
    transform: translate(0, 18px) scale(0.98);
  }
}

/* =====================================================
   JUMP
===================================================== */

.kiko-jump #kiko-elephant {
  animation: jump 0.95s cubic-bezier(.36, 1.35, .64, 1);
}

@keyframes jump {
  0% {
    transform: translateY(0) scaleX(1) scaleY(1);
  }

  20% {
    transform: translateY(8px) scaleX(1.07) scaleY(0.91);
  }

  50% {
    transform: translateY(-58px) scaleX(0.95) scaleY(1.07) rotate(-3deg);
  }

  72% {
    transform: translateY(-10px) scaleX(1.04) scaleY(0.96) rotate(2deg);
  }

  100% {
    transform: translateY(0) scaleX(1) scaleY(1) rotate(0);
  }
}

.kiko-jump #kiko-trunk {
  animation: trunkJump 0.95s ease-in-out;
}

@keyframes trunkJump {
  0%,
  100% {
    transform: rotate(0);
  }

  30% {
    transform: rotate(-12deg);
  }

  60% {
    transform: rotate(10deg);
  }
}

.kiko-jump #kiko-heart {
  animation: heartPop 0.95s ease-out;
}

@keyframes heartPop {
  0% {
    transform: scale(1);
  }

  40% {
    transform: scale(1.4);
  }

  70% {
    transform: scale(1.15);
  }

  100% {
    transform: scale(1);
  }
}

/* =====================================================
   DANCE
===================================================== */

.kiko-dance #kiko-elephant {
  animation: dance 1.6s ease-in-out;
}

@keyframes dance {
  0% {
    transform: rotate(0);
  }

  15% {
    transform: translateY(-7px) rotate(-7deg);
  }

  30% {
    transform: rotate(0);
  }

  45% {
    transform: translateY(-7px) rotate(7deg);
  }

  60% {
    transform: rotate(0);
  }

  75% {
    transform: translateY(-8px) rotate(-6deg);
  }

  90% {
    transform: translateY(-3px) rotate(5deg);
  }

  100% {
    transform: translateY(0) rotate(0);
  }
}

.kiko-dance #kiko-ear-left {
  animation: danceEarLeft 1.6s ease-in-out;
}

.kiko-dance #kiko-ear-right {
  animation: danceEarRight 1.6s ease-in-out;
}

@keyframes danceEarLeft {
  0%,
  100% {
    transform: rotate(0);
  }

  25% {
    transform: rotate(10deg);
  }

  50% {
    transform: rotate(-7deg);
  }

  75% {
    transform: rotate(10deg);
  }
}

@keyframes danceEarRight {
  0%,
  100% {
    transform: rotate(0);
  }

  25% {
    transform: rotate(-10deg);
  }

  50% {
    transform: rotate(7deg);
  }

  75% {
    transform: rotate(-10deg);
  }
}

.kiko-dance #kiko-trunk {
  animation: danceTrunk 1.6s ease-in-out;
}

@keyframes danceTrunk {
  0%,
  100% {
    transform: rotate(0);
  }

  25% {
    transform: rotate(-12deg);
  }

  50% {
    transform: rotate(10deg);
  }

  75% {
    transform: rotate(-12deg);
  }
}

/* =====================================================
   SPARKLES
===================================================== */

.kiko-sparkle {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  font-size: 22px;
}

.kiko-jump .kiko-sparkle,
.kiko-dance .kiko-sparkle {
  animation: sparkle 0.9s ease-out;
}

@keyframes sparkle {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }

  30% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform:
      translate(var(--dx), var(--dy))
      scale(1.1)
      rotate(180deg);
  }
}

/* =====================================================
   BUTTONS
===================================================== */

.kiko-btn-row {
  display: flex;
  gap: 16px;
}

.kiko-action-btn {
  min-width: 145px;
  border: none;
  border-radius: 999px;
  padding: 14px 26px;

  font-size: 16px;
  font-weight: 700;

  cursor: pointer;

  color: #571933;

  background: linear-gradient(
    135deg,
    #ffd1df,
    #f68caf
  );

  box-shadow:
    0 7px 18px rgba(244, 132, 169, 0.3);

  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.kiko-action-btn:hover {
  transform: translateY(-2px);
}

.kiko-action-btn:active {
  transform: scale(0.95);
}

.kiko-action-btn:disabled {
  opacity: 0.65;
}

.kiko-btn-dance {
  color: #174a76;

  background: linear-gradient(
    135deg,
    #c8eaff,
    #78c5f3
  );
}
`;

function Character() {
  const [isJumping, setIsJumping] = useState(false);
  const [isDancing, setIsDancing] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);

  const busy = isJumping || isDancing;

  /* =========================
     RANDOM BLINK
  ========================= */

  useEffect(() => {
    let timer;

    const blink = () => {
      setIsBlinking(true);

      setTimeout(() => {
        setIsBlinking(false);
      }, 140);

      timer = setTimeout(blink, 2500 + Math.random() * 3000);
    };

    timer = setTimeout(blink, 2500);

    return () => clearTimeout(timer);
  }, []);

  /* =========================
     ACTION
  ========================= */

  const handleAction = () => {
    if (busy) return;

    setIsJumping(true);

    setTimeout(() => {
      setIsJumping(false);
    }, 1000);
  };

  /* =========================
     DANCE
  ========================= */

  const handleDance = () => {
    if (busy) return;

    setIsDancing(true);

    setTimeout(() => {
      setIsDancing(false);
    }, 1650);
  };

  const wrapClass = [
    "kiko-char-wrap",
    isJumping ? "kiko-jump" : "",
    isDancing ? "kiko-dance" : "",
    isBlinking ? "kiko-blink" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className='kiko-stage'>
      <style>{styles}</style>

      <div className={wrapClass}>
        <svg
          id='kiko-elephant'
          viewBox='0 0 300 450'
          xmlns='http://www.w3.org/2000/svg'
        >
          <defs>
            {/* =================================================
                BODY
            ================================================= */}

            <linearGradient id='bodyGradient' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stopColor='#ffe0e9' />
              <stop offset='55%' stopColor='#fbc3d6' />
              <stop offset='100%' stopColor='#f3a5c0' />
            </linearGradient>

            {/* =================================================
                EARS
            ================================================= */}

            <linearGradient id='earGradient' x1='0' y1='0' x2='1' y2='1'>
              <stop offset='0%' stopColor='#ff9ebc' />
              <stop offset='55%' stopColor='#f76e9b' />
              <stop offset='100%' stopColor='#ef5688' />
            </linearGradient>

            {/* =================================================
                EAR HIGHLIGHT
            ================================================= */}

            <linearGradient id='earHighlight' x1='0' y1='0' x2='1' y2='1'>
              <stop offset='0%' stopColor='#ffffff' stopOpacity='0.75' />

              <stop offset='100%' stopColor='#ffffff' stopOpacity='0' />
            </linearGradient>

            {/* =================================================
                EYES
            ================================================= */}

            <radialGradient id='eyeGradient' cx='35%' cy='25%'>
              <stop offset='0%' stopColor='#453447' />
              <stop offset='40%' stopColor='#171019' />
              <stop offset='100%' stopColor='#050307' />
            </radialGradient>

            {/* =================================================
                HEART
            ================================================= */}

            <linearGradient id='heartGradient' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stopColor='#75e7cf' />
              <stop offset='100%' stopColor='#3bcbb0' />
            </linearGradient>

            {/* =================================================
                SHADOW
            ================================================= */}

            <radialGradient id='groundShadow'>
              <stop offset='0%' stopColor='#e87c9f' stopOpacity='0.28' />

              <stop offset='100%' stopColor='#e87c9f' stopOpacity='0' />
            </radialGradient>

            <filter id='blur' x='-50%' y='-50%' width='200%' height='200%'>
              <feGaussianBlur stdDeviation='5' />
            </filter>
          </defs>

          {/* =================================================
              GROUND
          ================================================= */}

          <ellipse
            cx='150'
            cy='423'
            rx='84'
            ry='13'
            fill='url(#groundShadow)'
            filter='url(#blur)'
          />

          <g id='kiko-body-group'>
            {/* =================================================
                LEFT EAR
            ================================================= */}

            <path
              id='kiko-ear-left'
              d='
                M101 124

                C76 91
                38 83
                18 107

                C-4 133
                5 183
                28 209

                C46 229
                71 226
                87 207

                C101 188
                106 151
                101 124

                Z
              '
              fill='url(#earGradient)'
            />

            <path
              d='
                M69 112

                C48 100
                29 109
                22 131

                C19 141
                19 150
                21 157

                C29 136
                40 122
                54 116

                C60 114
                65 113
                69 112

                Z
              '
              fill='url(#earHighlight)'
            />

            {/* =================================================
                RIGHT EAR
            ================================================= */}

            <path
              id='kiko-ear-right'
              d='
                M199 124

                C224 91
                262 83
                282 107

                C304 133
                295 183
                272 209

                C254 229
                229 226
                213 207

                C199 188
                194 151
                199 124

                Z
              '
              fill='url(#earGradient)'
            />

            <path
              d='
                M231 112

                C252 100
                271 109
                278 131

                C281 141
                281 150
                279 157

                C271 136
                260 122
                246 116

                C240 114
                235 113
                231 112

                Z
              '
              fill='url(#earHighlight)'
            />

            {/* =================================================
                BIG HEAD
            ================================================= */}

            <ellipse
              cx='150'
              cy='162'
              rx='83'
              ry='78'
              fill='url(#bodyGradient)'
            />

            {/* =================================================
                HEAD HIGHLIGHT
            ================================================= */}

            <ellipse
              cx='119'
              cy='124'
              rx='45'
              ry='27'
              fill='#fff4f8'
              opacity='0.35'
            />

            {/* =================================================
                HAIR
            ================================================= */}

            <path
              d='
                M143 87
                C137 75
                139 61
                149 51
                C154 47
                158 50
                158 56
                C159 66
                154 77
                151 89
                Z
              '
              fill='#f35d8d'
            />

            <path
              d='
                M153 87
                C158 73
                168 65
                179 66
                C185 67
                185 72
                180 77
                C172 84
                163 88
                153 91
                Z
              '
              fill='#f35d8d'
            />

            {/* =================================================
                BODY
                DIRECTLY ATTACHED TO HEAD
                LESS ROUND
            ================================================= */}
            <g transform='translate(0, -6)'>
              <path
                d='
                M113 238

                C90 247
                89 270
                88 300

                C80 329
                82 360
                100 389

                C99 410
                118 422
                150 422

               C182 422
               201 410
               200 389

               C218 360
               220 329
               212 300

               C211 270
               210 247
               187 238

                C176 246
                164 251
                150 251

                C136 251
                124 246
                113 238

                Z
              '
                fill='url(#bodyGradient)'
              />
            </g>

            {/* =================================================
                BELLY
            ================================================= */}

            <ellipse
              cx='150'
              cy='338'
              rx='53'
              ry='70'
              fill='#ffe3ec'
              opacity='0.35'
            />

            <ellipse
              cx='150'
              cy='319'
              rx='34'
              ry='44'
              fill='#fff0f5'
              opacity='0.17'
            />

            {/* =================================================
    LEFT ARM
    CLEAR GAP FROM BODY
================================================= */}
            <g transform='translate(15, -18) rotate(18 68 286)'>
              <path
                d='
                M76 286

                C61 295
                50 313
                47 333

                C44 351
                51 365
                65 370

                C78 374
                87 358
                82 340
                        
                C79 324
                81 304
                88 290

                C84 288
                80 287
                76 286

                Z
              '
                fill='url(#bodyGradient)'
              />

              {/* LEFT HAND NAILS */}

              <ellipse cx='59' cy='357' rx='6' ry='5' fill='#ffffff' />

              <ellipse cx='72' cy='360' rx='6' ry='5' fill='#ffffff' />
            </g>

            {/* =================================================
             RIGHT ARM
             CLEAR GAP FROM BODY
                ================================================= */}
            <g transform='translate(-10, -18) rotate(-18 244 300)'>
              <path
                d='
                M224 286

                C239 295
                250 313
                253 333

                C256 351
                249 365
                235 370

                C222 374
                213 358
                218 340

                C221 324
                219 304
                212 290

                C216 288
                220 287
                224 286

                Z
              '
                fill='url(#bodyGradient)'
              />

              {/* RIGHT HAND NAILS */}

              <ellipse cx='241' cy='357' rx='6' ry='5' fill='#ffffff' />

              <ellipse cx='228' cy='360' rx='6' ry='5' fill='#ffffff' />
            </g>

            {/* =================================================
                EYES
            ================================================= */}

            <ellipse
              id='kiko-eye-left'
              cx='120'
              cy='160'
              rx='16'
              ry='21'
              fill='url(#eyeGradient)'
            />

            <ellipse
              id='kiko-eye-right'
              cx='180'
              cy='160'
              rx='16'
              ry='21'
              fill='url(#eyeGradient)'
            />

            <circle cx='125' cy='153' r='5' fill='white' />

            <circle cx='185' cy='153' r='5' fill='white' />

            <circle cx='116' cy='172' r='2' fill='white' opacity='0.5' />

            <circle cx='176' cy='172' r='2' fill='white' opacity='0.5' />

            {/* =================================================
                CHEEKS
            ================================================= */}

            <ellipse
              cx='100'
              cy='193'
              rx='17'
              ry='11'
              fill='#f27fa4'
              opacity='0.6'
            />

            <ellipse
              cx='200'
              cy='193'
              rx='17'
              ry='11'
              fill='#f27fa4'
              opacity='0.6'
            />

            {/* =================================================
                TRUNK
            ================================================= */}

            <path
              id='kiko-trunk'
              d='
                M150 187

                C139 207
                137 228
                147 243

                C155 255
                159 267
                151 280
              '
              stroke='url(#bodyGradient)'
              strokeWidth='25'
              fill='none'
              strokeLinecap='round'
              style={{
                transformOrigin: "150px 187px",
              }}
            />

            {/* =================================================
                SMILE
            ================================================= */}

            <path
              d='
                M155 210
                Q160 224
                175 210
              '
              stroke='#dc4e7e'
              strokeWidth='3.2'
              fill='none'
              strokeLinecap='round'
            />

            {/* =================================================
                HEART
            ================================================= */}

            <g id='kiko-heart' transform='translate(214 220)'>
              <path
                d='
                  M0 8

                  C-9 -5
                  -24 1
                  -18 14

                  C-14 22
                  0 30
                  0 30

                  C0 30
                  14 22
                  18 14

                  C24 1
                  9 -5
                  0 8

                  Z
                '
                fill='url(#heartGradient)'
              />
            </g>

            {/* =================================================
                LEFT LEG
            ================================================= */}

            <path
              d='
                M91 351

                C87 373
                87 400
                94 415

                C100 429
                114 432
                129 428

                C140 425
                144 416
                144 403

                L144 364

                C128 371
                107 369
                91 351

                Z
              '
              fill='url(#bodyGradient)'
            />

            {/* =================================================
                RIGHT LEG
            ================================================= */}

            <path
              d='
                M209 351

                C213 373
                213 400
                206 415

                C200 429
                186 432
                171 428

                C160 425
                156 416
                156 403

                L156 364

                C172 371
                193 369
                209 351

                Z
              '
              fill='url(#bodyGradient)'
            />

            {/* =================================================
                LARGE LEG GAP
            ================================================= */}

            <path
              d='
                M144 365

                C147 378
                147 398
                147 414

                C148 419
                149 423
                150 425

                C151 423
                152 419
                153 414

                C153 398
                153 378
                156 365

                Z
              '
              fill='#ffffff'
            />

            {/* =================================================
                LEFT TOENAILS
            ================================================= */}

            <ellipse cx='103' cy='417' rx='8' ry='7' fill='#fff9fb' />

            <ellipse cx='120' cy='420' rx='8' ry='7' fill='#fff9fb' />

            <ellipse cx='135' cy='417' rx='8' ry='7' fill='#fff9fb' />

            {/* =================================================
                RIGHT TOENAILS
            ================================================= */}

            <ellipse cx='165' cy='417' rx='8' ry='7' fill='#fff9fb' />

            <ellipse cx='180' cy='420' rx='8' ry='7' fill='#fff9fb' />

            <ellipse cx='197' cy='417' rx='8' ry='7' fill='#fff9fb' />
          </g>
        </svg>

        {/* =================================================
            SPARKLES
        ================================================= */}

        <span
          className='kiko-sparkle'
          style={{
            top: "15%",
            left: "5%",
            "--dx": "-30px",
            "--dy": "-40px",
          }}
        >
          ✨
        </span>

        <span
          className='kiko-sparkle'
          style={{
            top: "11%",
            left: "85%",
            "--dx": "30px",
            "--dy": "-35px",
          }}
        >
          ✨
        </span>

        <span
          className='kiko-sparkle'
          style={{
            top: "50%",
            left: "2%",
            "--dx": "-25px",
            "--dy": "20px",
          }}
        >
          💫
        </span>

        <span
          className='kiko-sparkle'
          style={{
            top: "50%",
            left: "91%",
            "--dx": "25px",
            "--dy": "25px",
          }}
        >
          💫
        </span>
      </div>

      {/* =================================================
          BUTTONS
      ================================================= */}

      <div className='kiko-btn-row'>
        <button
          className='kiko-action-btn'
          onClick={handleAction}
          disabled={busy}
        >
          Action ✨
        </button>

        <button
          className='kiko-action-btn kiko-btn-dance'
          onClick={handleDance}
          disabled={busy}
        >
          Dance 🕺
        </button>
      </div>
    </div>
  );
}

export default Character;