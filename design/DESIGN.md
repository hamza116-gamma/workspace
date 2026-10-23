---
name: Ink & Paper
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#4c4546'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#5d5f5d'
  on-secondary: '#ffffff'
  secondary-container: '#e2e3e1'
  on-secondary-container: '#636563'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002112'
  on-tertiary-container: '#4b916c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#e2e3e1'
  secondary-fixed-dim: '#c6c7c5'
  on-secondary-fixed: '#1a1c1b'
  on-secondary-fixed-variant: '#454746'
  tertiary-fixed: '#a9f2c7'
  tertiary-fixed-dim: '#8dd6ac'
  on-tertiary-fixed: '#002112'
  on-tertiary-fixed-variant: '#005233'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
  ink-raised: '#0C0C0C'
  ink-secondary: '#555555'
  ink-tertiary: '#8A8A86'
  good: '#1E6846'
  good-tint: '#E7F2EC'
  data: '#1E4D8A'
  data-tint: '#E8EEF7'
  warn: '#8A6A30'
  warn-tint: '#FDF6EC'
  alert: '#A3462E'
  alert-tint: '#FDFLEE'
  live: '#7FC79A'
typography:
  display:
    fontFamily: Schibsted Grotesk
    fontSize: 66px
    fontWeight: '700'
    lineHeight: 68px
    letterSpacing: -0.04em
  headline:
    fontFamily: Schibsted Grotesk
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  title:
    fontFamily: Schibsted Grotesk
    fontSize: 23px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.02em
  item-title:
    fontFamily: Schibsted Grotesk
    fontSize: 14.5px
    fontWeight: '600'
    lineHeight: 20px
  body:
    fontFamily: Schibsted Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  caption:
    fontFamily: Schibsted Grotesk
    fontSize: 12.5px
    fontWeight: '400'
    lineHeight: 19px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  gutter-mobile: 20px
  gutter-desktop: 40px
---

## Brand & Style

The design system follows an **Ink-first, Minimal, and Functional** philosophy. It is built on the metaphor of a physical vault: secure, structured, and authoritative. The visual language avoids decorative flourishes, using "Ink" (black) as the primary driver of action and hierarchy, and "Paper" (white) as the foundational substrate.

The aesthetic leans into **Minimalism with a focus on Information Design**. Depth is achieved through tonal layering rather than shadows. The "Green Dot" is the sole brand-owned color, functioning as a "live" indicator that signifies connectivity and active recording.

The tone is professional, direct, and guidance-oriented. It prioritizes clarity over personality, ensuring the user feels in control of their vehicle's data. All communication uses active voice and sentence case, strictly avoiding exclamation marks to maintain a calm, serious demeanor.

## Colors

The palette is strictly functional. Color is never used for decoration; it is reserved for status, provenance, and the brand "live" state.

- **Ink (#000000):** Used for primary text, iconography, and high-priority actions.
- **Surface (#F6F6F4):** Used for card backgrounds and container wells.
- **Paper (#FFFFFF):** The base page background and nested card surface.
- **Status Colors:** These must always be paired (text color on its corresponding tint). They are system-generated and reflect the provenance of data (e.g., sensor-verified vs. manual entry).
- **The Dot:** Use `#1E6846` for the brand mark's dot.

## Typography

This system uses a single typeface, **Schibsted Grotesk**, relying on weight and tight tracking to create hierarchy.

- **Scale:** Use the Display and Headline levels sparingly for impact. Titles are the primary headers for screens and cards.
- **Tracking:** High-impact levels (Display, Headline, Title) use negative tracking to create a "dense" ink-heavy feel.
- **Numerals:** Big numbers for metrics use weight 700 and -2% tracking. Units (like "km" or "$") should be scaled to 40% of the number's size and set in the tertiary ink color.
- **Formatting:** Money always shows two decimals. Estimates must always show a range and a confidence label.

## Layout & Spacing

The layout is built on a **4px base grid** providing a rhythmic and structured feel.

- **Grid Model:** A fluid grid is used for mobile (20px margins) and a fixed-width centered grid for web (40px gutters).
- **Card Padding:** Elements within cards should maintain a consistent internal padding between 16px and 22px.
- **Rhythm:** Spacing between sections should follow the 4px increments, typically using `2xl` (24px) to separate distinct functional blocks.

## Elevation & Depth

This system intentionally avoids drop shadows and blurs. Depth is conveyed exclusively through **Tonal Layers**:

1.  **Level 0 (Background):** `--paper` (#FFFFFF).
2.  **Level 1 (Cards/Wells):** `--surface` (#F6F6F4) sits on top of paper.
3.  **Level 2 (Nested Items):** `--paper` (#FFFFFF) is used again for elements nested inside a surface-colored card.

This creates a "stamped" or "carved" look, reinforcing the functional and archival nature of the product. No borders should be used on light backgrounds unless they are specific outlined suggestion chips.

## Shapes

The shape language is precise and tiered. All interactive elements like buttons and status indicators use a **pill shape** for maximum distinctness from structural containers.

Container radii scale with the size of the component:
- **14px:** For nested internal elements and input fields.
- **18px:** For standard list cards.
- **24px:** For major page sections or hero containers.

## Components

### Buttons
- **Primary:** Pill-shaped, `--ink` fill with `--paper` text. Reserved for the single most important action on a screen.
- **Secondary:** Pill-shaped, `--surface` fill with `--ink` text.
- **Touch Target:** Minimum 44px height for mobile accessibility.

### Chips
- **Status/Provenance Chips:** Pill-shaped with tinted backgrounds and dark text. These are system-locked and indicate data validity (Good, Data, Warn, Alert).
- **Suggestion Chips:** Outlined pill with `--ink` text.

### Cards
- **List Cards:** Use the `--surface` well. Title and metadata are left-aligned. Actions are placed on the right.
- **Structure:** No shadows; use the tonal layering mentioned in the Elevation section.

### Input Fields
- Use the `sm` (14px) radius. Backgrounds should be `--paper` when sitting on a `--surface` card, or `--surface` when sitting on a `--paper` background to ensure contrast.

### Lists
- Standardize on clean rows with `--item-title` for primary information and `--caption` for timestamps or metadata.