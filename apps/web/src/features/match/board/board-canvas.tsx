import { Application } from "pixi.js";
import { useEffect, useRef } from "react";

/**
 * Creates the Pixi app once per mount. Later board layers subscribe to the
 * stores directly and update their own sprites, so this never re-renders.
 */
export function BoardCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    let ready = false;
    let disposed = false;

    void app
      .init({
        resizeTo: host,
        background: "#F7F8F5",
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio,
      })
      .then(() => {
        if (disposed) return app.destroy(true, { children: true, texture: true });
        ready = true;
        host.appendChild(app.canvas);
      });

    return () => {
      disposed = true;
      if (ready) app.destroy(true, { children: true, texture: true });
    };
  }, []);

  return <div ref={hostRef} className="aspect-square w-full" />;
}
