// Thanos Power Grip Magic Circle Shader for Phaser 3
window.ThanosPowerGripShader = class ThanosPowerGripShader extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
    constructor(game) {
        super({
            game: game,
            renderer: game.renderer,
            fragShader: `
                precision mediump float;
                
                uniform float time;
                uniform vec2 resolution;
                uniform sampler2D uMainSampler;
                varying vec2 outTexCoord;
                
                #define PI 3.14159265359
                #define TAU 6.28318530718
                
                // Hash function for noise
                float hash(vec2 p, float s) {
                    return fract(sin(dot(vec3(p.xy, 10.0 * abs(sin(s))), vec3(27.1, 61.7, 12.4))) * 273758.5453123);
                }
                
                // Noise function
                float noise(vec2 p, float s) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    return mix(
                        mix(hash(i + vec2(0., 0.), s), hash(i + vec2(1., 0.), s), f.x),
                        mix(hash(i + vec2(0., 1.), s), hash(i + vec2(1., 1.), s), f.x),
                        f.y
                    ) * s;
                }
                
                // Fractal brownian motion
                float fbm(vec2 p) {
                    float v = 0.0;
                    v += noise(p * 34., 0.1);
                    v += noise(p * 20., 0.04);
                    return v;
                }
                
                // Rotation matrix
                mat2 rot(float a) {
                    float c = cos(a);
                    float s = sin(a);
                    return mat2(c, -s, s, c);
                }
                
                // Smooth step functions
                float smootherstep(float edge0, float edge1, float x) {
                    x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
                    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
                }
                
                // Ring effect
                float ring(vec2 p, float radius, float width, float blur) {
                    float d = length(p) - radius;
                    return 1.0 - smoothstep(-width - blur, -width + blur, abs(d));
                }
                
                // Hexagon distance
                float hexagon(vec2 p, float r) {
                    vec2 q = abs(p);
                    return max(q.x * 0.866025 + q.y * 0.5, q.y) - r;
                }
                
                // Star shape
                float star(vec2 p, float r, int n) {
                    float a = atan(p.y, p.x);
                    float s = TAU / float(n);
                    a = mod(a + s * 0.5, s) - s * 0.5;
                    return length(p) * cos(a) - r;
                }
                
                // Main magic circle effect
                vec3 magicCircle(vec2 p) {
                    vec3 col = vec3(0.0);
                    
                    // Rotate the whole effect
                    p *= rot(time * 0.2);
                    
                    // Outer rings with energy flow
                    float r1 = ring(p, 0.8, 0.02, 0.01);
                    float r2 = ring(p, 0.85, 0.015, 0.01);
                    float r3 = ring(p, 0.9, 0.01, 0.005);
                    
                    // Add energy flow
                    vec2 polar = vec2(atan(p.y, p.x), length(p));
                    float energy = fbm(vec2(polar.x * 3.0 + time, polar.y * 10.0));
                    
                    // Inner hexagon
                    float hex = 1.0 - smoothstep(0.0, 0.02, abs(hexagon(p * rot(time * 0.5), 0.4)));
                    
                    // Central star
                    float starShape = 1.0 - smoothstep(0.0, 0.02, abs(star(p * rot(-time), 0.2, 6)));
                    
                    // Rotating symbols
                    vec2 sp = p * rot(time * 0.3);
                    for (int i = 0; i < 6; i++) {
                        float angle = float(i) * TAU / 6.0;
                        vec2 pos = vec2(cos(angle), sin(angle)) * 0.6;
                        float symbol = 1.0 - smoothstep(0.0, 0.01, length(sp - pos) - 0.05);
                        col += vec3(0.8, 0.3, 1.0) * symbol * 0.5;
                    }
                    
                    // Combine elements with purple/orange color scheme
                    col += vec3(0.8, 0.3, 1.0) * r1 * (1.0 + energy * 0.5);
                    col += vec3(1.0, 0.5, 0.2) * r2;
                    col += vec3(0.6, 0.2, 0.8) * r3;
                    col += vec3(1.0, 0.4, 0.1) * hex;
                    col += vec3(1.0, 0.8, 0.0) * starShape;
                    
                    // Add pulsing glow
                    float pulse = sin(time * 3.0) * 0.5 + 0.5;
                    col *= 1.0 + pulse * 0.3;
                    
                    return col;
                }
                
                void main() {
                    vec2 fragCoord = outTexCoord * resolution;
                    vec2 uv = (fragCoord - 0.5 * resolution) / min(resolution.x, resolution.y);
                    
                    // Scale for better visibility
                    uv *= 1.5;
                    
                    vec3 col = magicCircle(uv);
                    
                    // Add vignette
                    float vignette = 1.0 - length(uv) * 0.3;
                    col *= vignette;
                    
                    // Sample original texture
                    vec4 texColor = texture2D(uMainSampler, outTexCoord);
                    
                    // Blend with original texture
                    gl_FragColor = vec4(col + texColor.rgb, max(length(col), texColor.a));
                }
            `
        });
    }
    
    onPreRender() {
        this.set1f('time', this.game.loop.time / 1000.0);
        this.set2f('resolution', this.game.config.width, this.game.config.height);
    }
};

// Create the shader factory function
window.createThanosPowerGripShader = function(scene) {
    const shader = scene.game.renderer.addPipeline('ThanosPowerGrip', new window.ThanosPowerGripShader(scene.game));
    return shader;
};