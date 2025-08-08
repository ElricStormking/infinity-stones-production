// variables that influence quality
const int drift_count = 5; // decrease for more fps
const float step_size = 0.23; // increase for more fps

const float pi = 3.1415926;
const float field_of_view = 1.4;
const float camera_radius = 7.0;
const float nebula_radius = 6.0;

float noise3d(in vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
    vec2 rg = texture(iChannel0, (uv + 0.5)/256.0, -100.0).xy;
    return mix(rg.y, rg.x, f.z);
}

vec2 noise3d2(in vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
    vec4 rg = texture(iChannel0, (uv + 0.5)/256.0, -100.0);
    return vec2(mix(rg.y, rg.x, f.z), mix(rg.w, rg.z, f.z));
}

float fbm3d_low(in vec3 x) {
    float f = 0.0;
    f += 0.50000*noise3d(x); x = x*2.01;
    f += 0.25000*noise3d(x); x = x*2.02;
    f += 0.12500*noise3d(x); x = x*2.03;
    f += 0.06250*noise3d(x);
    return f;
}

float fbm3d(in vec3 x) {
    float f = 0.0;
    f += 0.50000*noise3d(x); x = x*2.01;
    f += 0.25000*noise3d(x); x = x*2.02;
    f += 0.12500*noise3d(x); x = x*2.03;
    f += 0.06250*noise3d(x); x = x*2.04;
    f += 0.03125*noise3d(x); x = x*2.01;
    f += 0.01562*noise3d(x);
    return f;
}

vec4 noise3d4_discontinuous(in vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
    return texture(iChannel0, (uv + 0.5)/256.0, -100.0);
}

vec4 noise2d4(in vec2 x) {
    vec2 p = floor(x);
    vec2 f = fract(x);
    f = f*f*(3.0-2.0*f);
    return texture(iChannel0, (p + f + 0.5)/256.0, -100.0);
}

vec3 star_color(in float noise) {
    // based on: http://www.vendian.org/mncharity/dir3/starcolor/
    // constant distribution and linear interpolation
    const vec3 coolest = vec3(0.615, 0.706, 1.000);
    const vec3 middle  = vec3(0.984, 0.972, 1.000);
    const vec3 hottest = vec3(1.000, 0.733, 0.482);
    return mix(mix(coolest, middle, smoothstep(0.0, 0.5, noise)),
               mix(middle, hottest, smoothstep(0.5, 1.0, noise)), step(0.5, noise));
}

vec3 only_mix(in vec3 src, in vec3 dst, in float start, in float end, in float amount) {
    return mix(src, dst, smoothstep(start, end, amount)) * step(start, amount) * step(-end, -amount);
}

vec3 nebula_color(in float noise) {
    // colors sampled from the Keyhole Nebula
    // https://commons.wikimedia.org/wiki/File:Keyhole_Nebula_-_Hubble_1999.jpg#/media/File:Keyhole_Nebula_-_Hubble_1999.jpg
    noise = clamp(noise, 0.0, 1.0);
    const vec3 blue   = vec3(0.635, 0.827, 0.996);
    const vec3 yellow = vec3(1.000, 0.823, 0.459);
    const vec3 red    = vec3(0.945, 0.584, 0.502);
    const vec3 orange = vec3(0.553, 0.231, 0.086);
    const vec3 brown  = vec3(0.360, 0.137, 0.062);
    const vec3 black  = vec3(0.095, 0.023, 0.043);
    return max(max(max(max(
           only_mix(blue, yellow,  0.0, 0.4, noise),
           only_mix(yellow, red,   0.4, 0.5, noise)),
           only_mix(red, orange,   0.5, 0.7, noise)),
           only_mix(orange, brown, 0.7, 0.8, noise)),
           only_mix(brown, black,  0.8, 1.0, noise));
}

vec3 star_field(in vec3 x, in float grid_size, out vec3 star_pos, out float star_brightness) {
    // a tiled randomly positioned dot, looks like stars.
    vec3 grid = floor(x * grid_size);
    vec3 pos = fract(x * grid_size);
    vec4 noise = noise3d4_discontinuous(grid);
    vec3 center = noise.xxy * 0.5 + 0.25;
    vec3 to_center = center - pos;
    vec3 out_of_plane = x * dot(to_center, x);
    float len = length(to_center - out_of_plane);
    float brightness = noise.w;
    float radius = mix(0.003, 0.009, pow(brightness, 9.0)) * grid_size;
    float show = step(0.8, noise.y);
    
    star_pos = (grid + center) / grid_size;
    star_brightness = show * brightness;
    return 2.0 * star_color(noise.z) * show * smoothstep(radius, 0.0, len);
}

vec2 screen_space(in vec3 x, in vec3 vx, in vec3 vy, in vec3 vz) {
    vec3 rescaled = field_of_view / dot(vz, x) * x;
    return vec2(dot(vx, rescaled), dot(vy, rescaled));
}

vec3 lens_flare(in vec2 x, in vec2 center, in float brightness) {
    // renders a lens flare at center
    // quantization might be unnecessary, it prevents flickering
    const float quantization = 500.0;
    const float flare_size = 0.5;
    vec2 to_x = (floor((x - center) * quantization) + 0.5) / quantization;
    float shape = max(0.0, 0.005 / pow(abs(to_x.x * to_x.y), flare_size) - 0.3);
    float radial_fade = smoothstep(0.04, 0.0, length(to_x));
    float brightness_fade = smoothstep(0.75, 1.0, brightness);
    return vec3(1.0) * shape * radial_fade * brightness_fade;
}

vec3 haze(in vec3 x, in vec3 background) {
    // add grainy star background (illusion of infinite stars)
    const float structure_size = 1.9;
    const float background_radiation = 0.2;
    float base_structure = fbm3d_low(x * structure_size);
    float star_structure = mix(smoothstep(0.35, 0.8, base_structure), 1.0, background_radiation);
    vec3 haze_color = 3.0 * vec3(0.058, 0.047, 0.096);
    float grain = mix(2.0, 2.0*noise3d(x * 800.0), 0.5);
    vec3 haze = haze_color * grain * smoothstep(0.1, 0.9, base_structure);
    return star_structure * background + haze;
}

vec3 drift_field(in vec3 x) {
    // provide a velocity field to drift the nebula (makes it streaky)
    // generate a divergence free field to make it look like fluid flow
    x = x * pi / nebula_radius;
    vec3 outwards = normalize(x) * 0.2;
    vec3 div_free = vec3(0.0);
    div_free += 0.50*sin(1.00*x+7.85).yzx;
    div_free += 0.25*cos(2.48*x+6.13).zxy;
    div_free += 0.12*cos(4.12*x+11.49).yzx;
    div_free += 0.06*sin(7.83*x+11.82).zxy;
    return outwards + div_free;
}

vec3 drift(in vec3 x, in float speed, out vec3 direction) {
    // drift backwards in time to sample the original nebula
    // keep the last velocity to help sample velocity aligned noise
    direction = drift_field(x);
    x -= direction * speed;
    for(int i=0; i<drift_count-1; i++) {
    	x -= drift_field(x) * speed;
    }
    return x;
}

vec4 nebula(in vec3 x) {
    // opacity via fbm
    float drift_speed = 0.2 * noise3d(x * 0.5 + 1.24);
    vec3 drift_velocity;
    vec3 x_drifted = drift(x, drift_speed, drift_velocity) * 0.7;
    float density = 0.01 + 0.2 * smoothstep(0.50, 0.90, fbm3d(x_drifted + 23.6));
    float radial_fade = smoothstep(nebula_radius, nebula_radius * 0.7, length(x));

    // color via mix of global noise and drift aligned noise
    float color_noise = noise3d(x_drifted);
    float aligned_noise = noise3d(10.0 * (x - dot(x, normalize(drift_velocity))));
    float noise = mix(color_noise, aligned_noise, 0.1);
    float brightness = 0.1 * 0.9 + smoothstep(0.0, 1.0, noise);
    vec3 color = mix(1.0, brightness, 0.7) * nebula_color(1.0 - noise);
    
    return vec4(color, radial_fade * density);
}

vec4 ray_trace(in vec3 origin, in vec3 ray) {
    const float loop_max = 1.5 * nebula_radius + camera_radius;
    const float fudge_factor = 2.1;
    vec4 acc = vec4(0.0);
    for(float i=0.0; i<loop_max; i+=step_size) {
        vec3 pos = origin + i * ray;
        vec4 samplez = nebula(pos);
        // TODO: accumulator is not step_size independent... why?
        // TODO: remove the fudge factor exp(w * step_size)
        acc = acc + (1.0 - acc.w) * vec4(samplez.xyz * samplez.w, samplez.w);
    }
    acc.xyz *= fudge_factor;
    return acc;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 pixel = -1.0 + 2.0 * fragCoord / iResolution.xy;
    pixel.x *= iResolution.x / iResolution.y;
    vec2 mouse = pi * ((iMouse.xy + 0.001) / iResolution.xy * vec2(-2.0, 1.0));

    // camera
    const float motion_speed = 1.0;
    float motion = (0.3 * cos(motion_speed * iTime * 0.2) + 0.7);
    mouse += mod(motion_speed * iTime * 0.1, 2.0 * pi);
    vec3 origin = camera_radius * motion * normalize(vec3(cos(mouse.x) * sin(mouse.y), cos(mouse.y), sin(mouse.x) * sin(mouse.y)));
    vec3 target = vec3(0.0);
    // orthonormal basis
    vec3 vz = normalize(target - origin);
    vec3 vx = normalize(cross(vec3(0.0, 1.0, 0.0), vz));
    vec3 vy = normalize(cross(vz, vx));
    // ray 
    vec3 ray = normalize(vx*pixel.x + vy*pixel.y + vz*field_of_view);
    vec4 trace = ray_trace(origin, ray);

    vec3 star_pos;
    float star_brightness;
    // stars
    fragColor = vec4(haze(ray, star_field(ray, 18.0, star_pos, star_brightness)), 1.0);
    // stars with lens flare
    fragColor += vec4(star_field(ray, 4.0, star_pos, star_brightness), 1.0);
    // lens flares
    fragColor += vec4(lens_flare(pixel, screen_space(star_pos, vx, vy, vz), star_brightness*1.6), 1.0);
    // nebula
    fragColor = vec4(mix(fragColor.xyz, trace.xyz, trace.w), 1.0);
}