import { useCallback, useRef, useState } from 'react';
import { Button, Modal } from './PrototypeUI';

export function useInlineEditGuard() {
  const dirty = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const onDirtyChange = useCallback((value: boolean) => { dirty.current = value; }, []);
  const guard = (action: () => void) => {
    if (dirty.current) setPending(() => action);
    else action();
  };
  const confirmation = pending && <Modal title="放弃未保存的修改？" width={460} onClose={() => setPending(null)} footer={<><Button onClick={() => setPending(null)}>继续编辑</Button><Button danger onClick={() => { dirty.current = false; setPending(null); pending(); }}>放弃修改</Button></>}>
    <p>当前修改尚未保存。离开编辑或收起明细会丢弃这些修改。</p>
  </Modal>;
  return { guard, onDirtyChange, confirmation };
}
