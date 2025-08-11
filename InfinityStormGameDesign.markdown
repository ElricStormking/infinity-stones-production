```markdown
# Game Design Document for "Infinity Storm"

## 1. Game Overview
"Infinity Storm" is a 6-reel, 5-row video slot game that immerses players in the Marvel Avengers universe, focusing solely on the epic battle between Thanos and Scarlet Witch. With high-volatility gameplay, a "Candy Crush"-style cascading mechanic, and engaging bonus features including Free Spins with accumulating multipliers and an "Infinity Power" feature, the game offers a maximum win potential of 5,000x the bet, appealing to Marvel fans and casino players alike. The game will be developed using the Phaser engine, utilizing extensive FX shaders and animation sprites, and will be playable in WebGL (HTML5) and on mobile web browsers. All game data, including player accounts and each spin bet record transactions, will be stored on a data server to prevent cheating.

## 2. Theme and Story
Set in the Marvel Cinematic Universe, "Infinity Storm" centers on the intense confrontation between Thanos, wielding the Infinity Gauntlet, and Scarlet Witch, whose chaos magic challenges his dominance. The game’s symbols and features are deeply rooted in this duel, featuring only these two iconic characters and the Infinity Stones, creating a focused and immersive experience.

## 3. Gameplay Mechanics
- **Reels and Layout:** 6 reels, 5 rows, no fixed paylines.
- **Bet Range:** $0.20 to $200 per spin.
- **RTP:** 96.00%
- **Volatility:** High
- **Max Win:** 5,000x bet

Winning combinations are formed by landing 8 or more matching symbol blocks anywhere on the grid. When this occurs, the matching blocks are destroyed, and new symbol blocks drop from the top to replace them, continuing until no more matches of 8+ are possible. This cascading mechanic increases win potential, balanced by the high volatility for thrilling gameplay.

## 4. Symbols
The symbols reflect the Thanos versus Scarlet Witch theme, divided into low-paying and high-paying categories, with special symbols for bonus activation and a dynamic multiplier feature.

| Symbol Type       | Description                                      | Payout (8+ Matches) |
|-------------------|--------------------------------------------------|---------------------|
| **Low-Paying**    | Space Gem, Mind Gem, Reality Gem, Power Gem, Time Gem | 2x to 5x bet        |
| **High-Paying**   | Thanos, Scarlet Witch, Thanos weapon,                 | 5x to 25x bet       |
| **Random Multiplier** | Random multiplier from 2x to 10x, represented by glowing Infinity Gem symbols; does not appear by regular spins but can replace a random regular symbol from time to time, triggered by a magic cast from Scarlet Witch or Thanos with animations and FX. | N/A                 |
| **Scatter**       | Infinity Glove (triggers bonus features)         | N/A                 |

## 5. Bonus Features
### 5.1 Infinity Power (Base Game)
- **Trigger:** When all 6 Infinity Gem symbols (Space Gem, Mind Gem, Reality Gem, Power Gem, Time Gem) blocks occur during the base game.
- **Effect:** Transforms a random reel into a multiplier reel for that spin, with a random multiplier of 2x, 3x, 4x, 6x, 8x, 10x, 100x, or 500x represented by Infinity Gem symbols, applied to any wins on that reel.
- **Frequency:** Adjusted to occur as a rare but rewarding event within the dynamic layout to maintain player engagement.

### 5.2 Free Spins
- **Trigger:** Landing 3, 4, or 5 Scatters (Infinity Glove) anywhere on the reels awards 15 Free Spins, respectively. Free Spins can also be bought with a minimum of 40 times and a maximum of 100 times the bet.
- **Mechanics:**
  - Every winning cascade during Free Spins applies a random multiplier of 2x, 3x, 4x, 6x, 8x, 10x, 100x, or 500x, represented by Infinity Gem symbols (e.g., Space Gem for 2x, Mind Gem for 3x, etc.), to the total win of that cascade.
  - Additional Scatters (Infinity Glove) during Free Spins award +2 extra Free Spins per Scatter.
  - All random multipliers will keep accumulating until Free Spins ends, with the total multiplier applied to the final win calculation.
- **Adaptation:** The cascading mechanic continues during Free Spins, with destroyed blocks replaced by new symbols, amplifying the bonus round’s excitement with the accumulating multipliers.

## 6. Audio and Visual Design
- **Visuals:** High-quality 3D graphics animate Thanos and Scarlet Witch, with the 6x5 grid featuring dynamic battlefield transitions and cascading animations. The Random Multiplier appearance is accompanied by magical animations and FX from Thanos or Scarlet Witch. Multipliers are visually represented by glowing Infinity Gem symbols during bonus features, enhanced by Phaser engine FX shaders and animation sprites.
- **Audio:** An orchestral soundtrack inspired by Marvel movies, with enhanced sound effects for cascading wins, bonus activations, and magical multiplier triggers.

## 7. Target Audience and Market Analysis
- **Target Audience:** Marvel enthusiasts and casino players who enjoy high-volatility slots with a focused narrative.
- **Market Analysis:** The Thanos and Scarlet Witch focus leverages their popularity, while the cascading 6x5 layout, inspired by "Storm of Seth" and "Candy Crush," attracts players seeking unique gameplay experiences.

## 8. Technical Specifications
- **Platform:** Optimized for WebGL (HTML5) and mobile web browsers using the Phaser engine, ensuring seamless performance on the 6x5 cascading grid.
- **Software:** Built with advanced slot development tools and Phaser for performance, security, and fairness, leveraging FX shaders and animation sprites. All game data, including player accounts and each spin bet record transactions, will be stored on a data server to prevent cheating.
- **Certifications:** Compliant with gambling regulations for legal operation.

## 9. Testing and Balancing
- Testing ensures a 96.5% RTP, with symbol probabilities and bonus frequencies balanced for the cascading 6x5 layout to maintain fairness and engagement.
- The grid is calibrated to support frequent cascading wins and larger bonus payouts, adjusted for the 8+ symbol match requirement, the Random Multiplier feature, and the accumulating multiplier mechanic.

## 10. Marketing and Promotion
- Launch with exclusive offers like free spins to attract players to the new cascading format.

## 11. Notes on Design Inspiration
The updated 6x5 reel setup with a cascading mechanic aligns with "Storm of Seth" by ATG Games, adapting its dynamic gem-matching style to the Thanos versus Scarlet Witch theme. The "Infinity Power" feature and Free Spins are tailored to enhance the cascading grid, with the 8+ symbol match rule, Infinity Gem multipliers, and Random Multiplier feature driving the "Candy Crush"-inspired gameplay.
