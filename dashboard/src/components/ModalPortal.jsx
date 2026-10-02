import { useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

const ModalPortal = ({ children }) => {
    const [container] = useState(() => {
        const el = document.createElement('div');
        el.className = 'modal-portal-root';

        Object.assign(el.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            zIndex: '2147483000',
            pointerEvents: 'none',
        });

        return el;
    });

    useLayoutEffect(() => {
        document.documentElement.appendChild(container);

        const correct = () => {
            container.style.transform = 'none';

            const r = container.getBoundingClientRect();

            if (r.left !== 0 || r.top !== 0) {
                container.style.transform =
                    `translate(${-r.left}px, ${-r.top}px)`;
            }
        };

        correct();

        window.addEventListener('resize', correct);

        return () => {
            window.removeEventListener('resize', correct);
            container.remove();
        };
    }, [container]);

    return createPortal(
        <div
            style={{
                pointerEvents: 'auto',
                width: '100%',
                height: '100%',
            }}
        >
            {children}
        </div>,
        container
    );
};

export default ModalPortal;