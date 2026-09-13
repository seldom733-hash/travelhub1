"use client";

import { useEffect } from "react";

/**
 * Design Token Injector — applies designConfig from the published constructor
 * config as CSS custom properties on `:root`. This allows all marketplace
 * components to use these tokens via standard CSS variable references.
 *
 * Accepts designConfig as a prop — no separate fetch needed.
 */

interface DesignConfig {
  typography?: {
    fontFamily?: string;
    headingFont?: string;
    bodyFont?: string;
    baseFontSize?: number;
    headingWeight?: number;
    lineHeight?: number;
    letterSpacing?: string;
  };
  colors?: {
    background?: string;
    surface?: string;
    text?: string;
    mutedText?: string;
    accent?: string;
    border?: string;
  };
  spacing?: {
    sectionSpacing?: number;
    containerWidth?: number;
    internalPadding?: number;
  };
  components?: {
    cardRadius?: number;
    buttonRadius?: number;
    inputRadius?: number;
  };
}

function applyDesignTokens(designConfig: DesignConfig | null) {
  if (!designConfig) return;

  const root = document.documentElement;
  const tokens: Record<string, string> = {};

  // Colors → CSS custom properties
  if (designConfig.colors) {
    const c = designConfig.colors;
    if (c.background) tokens["--th-bg"] = c.background;
    if (c.surface) tokens["--th-surface"] = c.surface;
    if (c.text) tokens["--th-text"] = c.text;
    if (c.mutedText) tokens["--th-muted"] = c.mutedText;
    if (c.accent) tokens["--th-accent"] = c.accent;
    if (c.border) tokens["--th-border"] = c.border;
  }

  // Typography → CSS custom properties
  if (designConfig.typography) {
    const t = designConfig.typography;
    if (t.fontFamily) tokens["--th-font-body"] = t.fontFamily;
    if (t.headingFont) tokens["--th-font-heading"] = t.headingFont;
    if (t.baseFontSize) tokens["--th-font-size"] = `${t.baseFontSize}px`;
    if (t.headingWeight) tokens["--th-heading-weight"] = String(t.headingWeight);
    if (t.lineHeight) tokens["--th-line-height"] = String(t.lineHeight);
    if (t.letterSpacing) tokens["--th-letter-spacing"] = t.letterSpacing;
  }

  // Spacing → CSS custom properties
  if (designConfig.spacing) {
    const s = designConfig.spacing;
    if (s.sectionSpacing) tokens["--th-section-spacing"] = `${s.sectionSpacing}px`;
    if (s.containerWidth) tokens["--th-container-width"] = `${s.containerWidth}px`;
    if (s.internalPadding) tokens["--th-padding"] = `${s.internalPadding}px`;
  }

  // Components → CSS custom properties
  if (designConfig.components) {
    const comp = designConfig.components;
    if (comp.cardRadius !== undefined) tokens["--th-radius-card"] = `${comp.cardRadius}px`;
    if (comp.buttonRadius !== undefined) tokens["--th-radius-btn"] = `${comp.buttonRadius}px`;
    if (comp.inputRadius !== undefined) tokens["--th-radius-input"] = `${comp.inputRadius}px`;
  }

  // Apply all tokens at once
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }

  // Apply derived styles that use the tokens
  if (tokens["--th-bg"]) {
    root.style.setProperty("background", tokens["--th-bg"]);
    document.body.style.background = tokens["--th-bg"];
  }
  if (tokens["--th-text"]) {
    document.body.style.color = tokens["--th-text"];
  }
  if (tokens["--th-font-body"]) {
    document.body.style.fontFamily = tokens["--th-font-body"];
  }
  if (tokens["--th-font-size"]) {
    root.style.fontSize = tokens["--th-font-size"];
  }
}

export default function DesignTokenInjector({ designConfig }: { designConfig?: Record<string, unknown> | null }) {
  useEffect(() => {
    if (!designConfig) return;
    applyDesignTokens(designConfig as DesignConfig);
  }, [designConfig]);

  return null; // No DOM output — side-effect only
}
