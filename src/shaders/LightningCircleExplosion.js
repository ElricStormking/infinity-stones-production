window.LightningCircleExplosionShader = {
    fragmentShader: `
        precision mediump float;
        
        uniform float time;
        uniform vec2 resolution;
        uniform float progress;  // 0.0 to 1.0 animation progress
        uniform float intensity;
        
        #define PI 3.14159265359
        
        // Noise function for electric effect
        float noise(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        // Electric arc pattern
        float electricArc(vec2 uv, float angle, float t) {
            vec2 dir = vec2(cos(angle), sin(angle));
            float dist = dot(uv, dir);
            
            // Create jagged lightning pattern
            float lightning = 0.0;
            for(float i = 0.0; i < 5.0; i++) {
                float freq = 10.0 + i * 5.0;
                float amp = 0.02 / (i + 1.0);
                lightning += sin(dist * freq + t * 3.0 + i * 1.5) * amp;
            }
            
            float perpDist = abs(dot(uv, vec2(-dir.y, dir.x)) + lightning);
            return smoothstep(0.015, 0.0, perpDist);
        }
        
        void main() {
            vec2 uv = (gl_FragCoord.xy - resolution.xy * 0.5) / min(resolution.x, resolution.y);
            
            // Expanding circle radius based on progress
            float explosionRadius = progress * 0.8;
            float fadeOut = 1.0 - smoothstep(0.7, 1.0, progress);
            
            // Distance from center
            float dist = length(uv);
            
            // Main circle ring
            float ring = smoothstep(explosionRadius - 0.15, explosionRadius - 0.05, dist) *
                        smoothstep(explosionRadius + 0.05, explosionRadius - 0.02, dist);
            
            // Inner glow
            float innerGlow = exp(-dist * 3.0 / (progress + 0.1)) * 0.5;
            
            // Lightning arcs radiating outward
            vec3 lightning = vec3(0.0);
            float numArcs = 12.0;
            
            for(float i = 0.0; i < numArcs; i++) {
                float angle = (i / numArcs) * PI * 2.0;
                
                // Rotating offset for dynamic movement
                angle += time * 0.5 + noise(vec2(i, time * 0.1)) * 0.3;
                
                // Scale UV for arc calculation
                vec2 arcUV = uv * (1.0 + progress * 0.5);
                
                // Create electric arc
                float arc = electricArc(arcUV, angle, time * 2.0 + i);
                
                // Fade arc based on distance and progress
                float arcFade = smoothstep(explosionRadius + 0.2, explosionRadius - 0.1, dist);
                arc *= arcFade * fadeOut;
                
                lightning += arc;
            }
            
            // Magic circle patterns
            float circlePattern = 0.0;
            float angleFromCenter = atan(uv.y, uv.x);
            
            // Rotating rune patterns
            for(float i = 1.0; i < 4.0; i++) {
                float patternRadius = explosionRadius * (0.7 + i * 0.1);
                float pattern = smoothstep(0.01, 0.0, abs(dist - patternRadius));
                
                // Add angular modulation for rune-like appearance
                float runePattern = sin(angleFromCenter * 8.0 * i + time * 2.0) * 0.5 + 0.5;
                pattern *= runePattern;
                
                circlePattern += pattern * (1.0 - i * 0.2);
            }
            
            // Energy burst particles
            float particles = 0.0;
            for(float i = 0.0; i < 20.0; i++) {
                vec2 particlePos = vec2(
                    cos(i * 0.31415 + time) * explosionRadius * (1.0 + noise(vec2(i, time)) * 0.3),
                    sin(i * 0.31415 + time) * explosionRadius * (1.0 + noise(vec2(i + 100.0, time)) * 0.3)
                );
                
                float particle = exp(-length(uv - particlePos) * 50.0) * 3.0;
                particles += particle;
            }
            
            // Combine all effects
            vec3 color = vec3(0.0);
            
            // Purple base color
            vec3 purpleColor = vec3(0.7, 0.0, 1.0);
            vec3 electricBlue = vec3(0.3, 0.5, 1.0);
            vec3 white = vec3(1.0);
            
            // Main ring with purple gradient
            color += purpleColor * ring * 2.0;
            
            // Inner glow with blue-purple gradient
            color += mix(electricBlue, purpleColor, dist * 2.0) * innerGlow * fadeOut;
            
            // Lightning with white-purple gradient
            color += mix(white, purpleColor, 0.3) * lightning * intensity;
            
            // Circle patterns with purple glow
            color += purpleColor * circlePattern * 0.5 * fadeOut;
            
            // Bright particles
            color += mix(white, electricBlue, 0.5) * particles * fadeOut;
            
            // Outer shockwave
            float shockwave = smoothstep(explosionRadius + 0.1, explosionRadius + 0.15, dist) *
                             smoothstep(explosionRadius + 0.25, explosionRadius + 0.2, dist);
            color += purpleColor * shockwave * 0.5 * fadeOut;
            
            // Add bloom effect
            color *= 1.0 + intensity * 0.5;
            
            // Output with alpha
            gl_FragColor = vec4(color, max(max(color.r, color.g), color.b) * fadeOut);
        }
    `
};