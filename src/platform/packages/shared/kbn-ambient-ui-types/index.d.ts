/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/// <reference path="./emotion.d.ts" />

declare module '*.html' {
  const template: string;
  // eslint-disable-next-line import/no-default-export
  export default template;
}

declare module '*.png' {
  const content: string;
  // eslint-disable-next-line import/no-default-export
  export default content;
}

declare module '*.svg' {
  const content: string;
  // eslint-disable-next-line import/no-default-export
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  // eslint-disable-next-line import/no-default-export
  export default content;
}

declare module '*.jpg' {
  const content: string;
  // eslint-disable-next-line import/no-default-export
  export default content;
}

declare module '*.webp' {
  const content: string;
  // eslint-disable-next-line import/no-default-export
  export default content;
}

declare module '*.gif' {
  const content: string;
  // eslint-disable-next-line import/no-default-export
  export default content;
}

declare module '*.mdx' {
  let MDXComponent: (props: any) => JSX.Element;
  // eslint-disable-next-line import/no-default-export
  export default MDXComponent;
}

declare module '*?asUrl' {
  const content: string;
  // eslint-disable-next-line import/no-default-export
  export default string;
}

declare module '*?raw' {
  const content: string;
  // eslint-disable-next-line import/no-default-export
  export default string;
}

// canvg ships types at lib/index.d.ts but its exports field lacks a `types`
// condition, so bundler module resolution can't find them.
declare module 'canvg' {
  // eslint-disable-next-line import/no-default-export
  export default class Canvg {
    static fromString(ctx: CanvasRenderingContext2D, svg: string, options?: any): Canvg;
    static from(ctx: CanvasRenderingContext2D, url: string, options?: any): Promise<Canvg>;
    render(options?: any): Promise<void>;
    start(options?: any): void;
    stop(): void;
    resize(width: number, height?: number, preserveAspectRatio?: boolean | string): void;
  }
  export { Canvg };
}
