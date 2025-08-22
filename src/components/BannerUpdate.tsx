import { useEffect, useState } from 'react';

export default function BannerUpdate() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener('sw:update', handler);
    return () => window.removeEventListener('sw:update', handler);
  }, []);
  if (!show) return null;
  return (
    <div role="status" style={{ background: '#ff0', padding: 8 }}>
      Hay datos nuevos → <button onClick={() => location.reload()}>Recargar</button>
    </div>
  );
}
