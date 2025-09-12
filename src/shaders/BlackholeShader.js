// Blackhole Effect Shader for Phaser 3
// Based on the GLSL code from https://x.com/cmzw_/status/1787147460772864188 (celestianmaze)
window.BlackholeShader = class BlackholeShader extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
    constructor(game) {
        super({
            game: game,
            renderer: game.renderer,
            fragShader: `
                precision highp float;
                
                uniform float time;
                uniform vec2 resolution;
                uniform float intensity;
                uniform float scale;
                // Offset the shader content in UV space (x,y). Positive y moves the blackhole UP.
                uniform vec2 centerOffset;
                uniform sampler2D uMainSampler;
                varying vec2 outTexCoord;
                
                // Blackhole shader implementation - exact GLSL from sample
                vec4 permute_3d(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
                vec4 taylorInvSqrt3d(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

                float simplexNoise3d(vec3 v)
                {
                    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
                    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

                    // First corner
                    vec3 i  = floor(v + dot(v, C.yyy) );
                    vec3 x0 =   v - i + dot(i, C.xxx) ;

                    // Other corners
                    vec3 g = step(x0.yzx, x0.xyz);
                    vec3 l = 1.0 - g;
                    vec3 i1 = min( g.xyz, l.zxy );
                    vec3 i2 = max( g.xyz, l.zxy );

                    //  x0 = x0 - 0. + 0.0 * C
                    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
                    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
                    vec3 x3 = x0 - 1. + 3.0 * C.xxx;

                    // Permutations
                    i = mod(i, 289.0 );
                    vec4 p = permute_3d( permute_3d( permute_3d( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))  + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

                    // Gradients
                    // ( N*N points uniformly over a square, mapped onto an octahedron.)
                    float n_ = 1.0/7.0; // N=7
                    vec3  ns = n_ * D.wyz - D.xzx;

                    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

                    vec4 x_ = floor(j * ns.z);
                    vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

                    vec4 x = x_ *ns.x + ns.yyyy;
                    vec4 y = y_ *ns.x + ns.yyyy;
                    vec4 h = 1.0 - abs(x) - abs(y);

                    vec4 b0 = vec4( x.xy, y.xy );
                    vec4 b1 = vec4( x.zw, y.zw );

                    vec4 s0 = floor(b0)*2.0 + 1.0;
                    vec4 s1 = floor(b1)*2.0 + 1.0;
                    vec4 sh = -step(h, vec4(0.0));

                    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
                    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

                    vec3 p0 = vec3(a0.xy,h.x);
                    vec3 p1 = vec3(a0.zw,h.y);
                    vec3 p2 = vec3(a1.xy,h.z);
                    vec3 p3 = vec3(a1.zw,h.w);

                    // Normalise gradients
                    vec4 norm = taylorInvSqrt3d(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
                    p0 *= norm.x;
                    p1 *= norm.y;
                    p2 *= norm.z;
                    p3 *= norm.w;

                    // Mix final noise value
                    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                    m = m * m;
                    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
                }

                float fbm3d(vec3 x, const in int it) {
                    float v = 0.0;
                    float a = 0.5;
                    vec3 shift = vec3(100);

                    for (int i = 0; i < 32; ++i) {
                        if(i<it) {
                            v += a * simplexNoise3d(x);
                            x = x * 2.0 + shift;
                            a *= 0.5;
                        }
                    }
                    return v;
                }

                // Reduce rotational bias so the center remains more aligned in the mask
                vec3 rotateZ(vec3 v, float angle) {
                    float cosAngle = cos(angle);
                    float sinAngle = sin(angle);
                    return vec3(
                        v.x * cosAngle - v.y * sinAngle,
                        v.x * sinAngle + v.y * cosAngle,
                        v.z
                    );
                }

                float facture(vec3 vector) {
                    vec3 normalizedVector = normalize(vector);
                    return max(max(normalizedVector.x, normalizedVector.y), normalizedVector.z);
                }

                vec3 emission(vec3 color, float strength) {
                    return color * strength;
                }
                
                void main() {
                    // Use time for iTime and resolution for iResolution from the original shader
                    float iTime = time;
                    vec2 iResolution = resolution;
                    
                    // Normalized pixel coordinates (from 0 to 1) and (from -1 to 1)
                    vec2 uv = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;
                    // Shift content relative to the screen center (not the mask)
                    uv -= centerOffset;
                    
                    vec3 color = vec3(uv.xy, 0.0);
                    color.z += 0.5;
                    
                    color = normalize(color);
                    color -= 0.2 * vec3(0.0, 0.0, iTime);
                    
                    float angle = -1.2 * log2(length(uv)); // damp rotation a bit to keep center tighter, the higher the number the tighter the center
                    
                    color = rotateZ( color, angle );
                    
                    float frequency = 1.1 * scale; // Use scale parameter to control frequency, original 1.4
                    float distortion = 0.01;
                    color.x = fbm3d(color * frequency + 0.0, 5) + distortion;
                    color.y = fbm3d(color * frequency + 1.0, 5) + distortion;
                    color.z = fbm3d(color * frequency + 2.0, 5) + distortion;
                    vec3 noiseColor = color; // save
                    
                    noiseColor *= 2.0;
                    noiseColor -= 0.1;
                    noiseColor *= 0.188;
                    noiseColor += vec3(uv.xy, 0.0);
                    
                    float noiseColorLength = length(noiseColor);
                    noiseColorLength = 0.770 - noiseColorLength;
                    noiseColorLength *= 4.2;
                    noiseColorLength = pow(noiseColorLength, 1.0);
                    
                    // Aqua-green emission (shifted slightly towards green)
                    vec3 emissionColor = emission(vec3(0.15, 0.95, 0.70), noiseColorLength * 0.22);
                    
                    float fac = length(uv) - facture(color + 0.32);
                    fac += 0.1;
                    fac *= 3.0;
                    
                    color = mix(emissionColor, vec3(fac), fac + 1.2);
                    // Apply an overall aqua-green tint to the final color
                    color *= vec3(0.35, 0.95, 0.75);
                    
                    // Apply intensity for fade in/out control
                    color *= intensity;
                    
                    // Output to screen
                    gl_FragColor = vec4(color, 1.0);
                }
            `
        });
        
        // Debug: track shader creation
        if (!game.__blackholePipelineCreateCount) game.__blackholePipelineCreateCount = 0;
        game.__blackholePipelineCreateCount++;
        if (typeof window !== 'undefined' && window.DEBUG) {
            console.log(`🕳️ BlackholeShader constructed (count=${game.__blackholePipelineCreateCount}) at ${new Date().toLocaleTimeString()}`);
        }
    }
    
    onPreRender() {
        this.set1f('time', this.game.loop.time / 1000.0);
        this.set2f('resolution', this.game.config.width, this.game.config.height);
        this.set1f('intensity', this.intensity || 0.5);
        this.set1f('scale', this.scale || 0.3);
        const offX = (typeof this.centerOffsetX === 'number') ? this.centerOffsetX : 0.0;
        const offY = (typeof this.centerOffsetY === 'number') ? this.centerOffsetY : 0.0;
        this.set2f('centerOffset', offX, offY);
    }
    
    setIntensity(value) {
        this.intensity = value;
    }
    
    setScale(value) {
        this.scale = value;
    }

    // Move shader content without changing the circular mask
    // Positive y moves the blackhole UP (toward negative screen y)
    setCenterOffset(x, y) {
        this.centerOffsetX = x || 0.0;
        this.centerOffsetY = y || 0.0;
    }
};

// Create the shader factory function
window.createBlackholeShader = function(scene) {
    try {
        // Create the shader pipeline instance
        const mgr = scene.game.renderer.pipelines || scene.game.renderer;
        if (mgr.get && mgr.get('Blackhole')) {
            if (window.DEBUG) console.warn('🕳️ Blackhole pipeline already exists – reusing.');
            return mgr.get('Blackhole');
        }

        const shader = new window.BlackholeShader(scene.game);
        if (scene.game.renderer.pipelines) {
            scene.game.renderer.pipelines.add('Blackhole', shader);
        } else {
            scene.game.renderer.addPipeline('Blackhole', shader);
        }
        return shader;
    } catch (error) {
        console.error('Failed to create Blackhole shader:', error);
        throw error;
    }
};