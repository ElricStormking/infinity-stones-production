// Red Lightning Shader for Scarlet Witch Random Multiplier effect
window.RedLightningShader = {
    vertexShader: `
        attribute vec2 inPosition;
        attribute vec2 inTexCoord;
        
        uniform mat3 uProjectionMatrix;
        
        varying vec2 vTexCoord;
        varying vec2 vPosition;
        
        void main() {
            vTexCoord = inTexCoord;
            vPosition = inPosition;
            gl_Position = vec4((uProjectionMatrix * vec3(inPosition, 1.0)).xy, 0.0, 1.0);
        }
    `,
    
    fragmentShader: `
        precision mediump float;
        
        uniform sampler2D uMainSampler;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec2 uTargetPosition;
        uniform float uIntensity;
        
        varying vec2 vTexCoord;
        varying vec2 vPosition;
        
        #define PI 3.14159265359
        
        // Hash function for noise
        vec2 hash(vec2 p) {
            p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
            return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
        }
        
        // Perlin noise
        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            
            return mix(mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                          dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
                      mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                          dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
        }
        
        // Fractal noise
        float fbm(vec2 p) {
            float v = 0.0;
            float s = 1.0;
            for(int i = 0; i < 4; i++) {
                v += s * noise(p);
                p *= 2.0;
                s *= 0.5;
            }
            return v;
        }
        
        // Vertical lightning bolt function for columns
        float verticalLightning(vec2 uv, float columnX, float time, float offset) {
            // Create vertical lightning path with noise - twice as thick
            float horizontalNoise = fbm(vec2(time * 3.0 + offset, uv.y * 4.0)) * 0.04; // Increased noise for thickness
            float pathX = columnX + horizontalNoise;
            
            // Add more branching for dramatic effect
            pathX += fbm(vec2(time * 6.0 + offset, uv.y * 8.0)) * 0.03;
            
            // Distance from the lightning path (horizontal distance from column)
            float dist = abs(uv.x - pathX);
            
            // Create thicker glow effect (doubled thickness)
            float bolt = 0.0;
            bolt += 0.03 / (dist + 0.005) * uIntensity; // Doubled thickness
            bolt += 0.012 / (dist + 0.025) * uIntensity * 0.5; // Doubled thickness  
            bolt += 0.006 / (dist + 0.05) * uIntensity * 0.25; // Doubled thickness
            
            // Add flickering with vertical progression
            bolt *= 0.7 + 0.3 * sin(time * 20.0 + uv.y * 8.0 + offset);
            
            // Fade based on vertical position (stronger at top, weaker at bottom)
            bolt *= 1.0 - (uv.y * 0.3);
            
            return bolt;
        }
        
        void main() {
            vec2 uv = vPosition / uResolution;
            
            // Get original texture color
            vec4 texColor = texture2D(uMainSampler, vTexCoord);
            
            // Calculate lightning effect across all 6 grid columns
            float totalLightningEffect = 0.0;
            
            // Define the 6 grid column positions (normalized 0.0 to 1.0)
            // Assuming grid takes up center portion of screen
            float gridStartX = 0.3;  // Grid starts at 30% of screen width
            float gridEndX = 0.7;    // Grid ends at 70% of screen width
            float columnWidth = (gridEndX - gridStartX) / 6.0;
            
            // Create vertical lightning for each of the 6 columns
            for(float col = 0.0; col < 6.0; col++) {
                float columnX = gridStartX + (col + 0.5) * columnWidth; // Center of each column
                float timeOffset = col * 0.3; // Stagger the lightning timing
                
                // Add lightning for this column
                totalLightningEffect += verticalLightning(uv, columnX, uTime, timeOffset);
            }
            
            // Create red/pink color for Scarlet Witch's chaos magic - more intense
            vec3 lightningColor = vec3(1.0, 0.1, 0.3); // Brighter red with slight pink
            lightningColor += vec3(0.8, 0.0, 0.4) * totalLightningEffect; // Add more red/magenta glow
            
            // Apply the lightning effect
            vec3 finalColor = texColor.rgb + lightningColor * totalLightningEffect;
            
            // Add screen-wide electrical energy effect
            float screenGlow = sin(uTime * 8.0) * 0.05 * uIntensity;
            finalColor += vec3(0.3, 0.0, 0.1) * screenGlow;
            
            gl_FragColor = vec4(finalColor, texColor.a);
        }
    `
};