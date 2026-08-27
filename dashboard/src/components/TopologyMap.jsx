import React from 'react';
import { Server, Database, ShoppingCart, UserCheck, HardDrive } from 'lucide-react';

const ServiceNode = ({ name, icon: Icon, isFailed, isRecovering }) => {
  let borderColor = '#86EFAC';
  let bgColor = '#F0FDF4';
  let glow = 'none';

  if (isFailed) {
    borderColor = '#FCA5A5';
    bgColor = '#FEF2F2';
    glow = '0 4px 12px rgba(220, 38, 38, 0.08)';
  } else if (isRecovering) {
    borderColor = '#93C5FD';
    bgColor = '#EFF6FF';
    glow = '0 4px 12px rgba(37, 99, 235, 0.08)';
  } else {
    borderColor = '#86EFAC';
  }

  return (
    <div style={{
      padding: '1rem',
      borderRadius: '12px',
      border: `1px solid ${borderColor}`,
      background: bgColor,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.5rem',
      minWidth: '100px',
      boxShadow: glow,
      transition: 'all 0.3s ease'
    }}>
      <div style={{
        background: '#FFFFFF',
        border: `1px solid ${borderColor}`,
        padding: '0.8rem',
        borderRadius: '50%',
        color: isFailed ? '#DC2626' : isRecovering ? '#2563EB' : '#16A34A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={24} />
      </div>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1F2937' }}>{name}</span>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isFailed ? '#DC2626' : isRecovering ? '#2563EB' : '#16A34A' }}>
        {isFailed ? 'CRASHLOOP' : isRecovering ? 'RESTARTING' : 'RUNNING'}
      </span>
    </div>
  );
};

const topologyStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2rem',
    padding: '1rem',
    position: 'relative'
  },
  row: {
    display: 'flex',
    gap: '2rem',
    justifyContent: 'center',
    width: '100%'
  },
  line: {
    position: 'absolute',
    borderLeft: '2px dashed #E5E7EB',
    zIndex: 0
  }
};

const TopologyMap = ({ systemState, failingNode }) => {
  const isAnomaly = systemState === 'anomaly' || systemState === 'rca';
  const isRecovering = systemState === 'remediation' || systemState === 'recovering';

  const paymentFailed = isAnomaly && failingNode === 'payment';
  const paymentRecovering = isRecovering && failingNode === 'payment';

  const frontendFailed = isAnomaly && failingNode === 'frontend';
  const frontendRecovering = isRecovering && failingNode === 'frontend';

  return (
    <div style={topologyStyles.container}>
      {/* Level 1: Ingress / Frontend */}
      <div style={{ ...topologyStyles.row, zIndex: 1 }}>
        <ServiceNode name="React Frontend" icon={UserCheck} isFailed={frontendFailed} isRecovering={frontendRecovering} />
      </div>

      {/* Level 2: Core Services */}
      <div style={{ ...topologyStyles.row, zIndex: 1 }}>
        <ServiceNode name="Cart Service" icon={ShoppingCart} isFailed={false} isRecovering={false} />
        <ServiceNode name="Payment Service" icon={HardDrive} isFailed={paymentFailed} isRecovering={paymentRecovering} />
        <ServiceNode name="Product Service" icon={Server} isFailed={false} isRecovering={false} />
      </div>

      {/* Level 3: Data layer */}
      <div style={{ ...topologyStyles.row, zIndex: 1 }}>
        <ServiceNode name="Order DB" icon={Database} isFailed={false} isRecovering={false} />
        <ServiceNode name="Payment DB" icon={Database} isFailed={paymentFailed} isRecovering={paymentRecovering} />
      </div>
    </div>
  );
};

export default TopologyMap;
