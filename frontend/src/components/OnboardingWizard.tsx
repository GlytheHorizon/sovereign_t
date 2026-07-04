import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Key, FolderOpen, Star, Lock, Brain, Ghost, ArrowRight, Check,
  Smartphone, LayoutDashboard, Network,
} from 'lucide-react';

interface OnboardingWizardProps {
  onClose: () => void;
}

const STEPS = [
  {
    title: 'Welcome to Sovereign-T',
    subtitle: 'Your encrypted digital vault',
    icon: <Shield size={32} />,
    description: 'Sovereign-T is a local-first, encrypted password manager. Your data never leaves your device. All secrets are encrypted with AES-256-GCM before they touch disk.',
    color: 'var(--accent)',
  },
  {
    title: 'Storing Credentials',
    subtitle: 'Add and organize your accounts',
    icon: <Key size={32} />,
    description: 'Click "Add Account" to save usernames, passwords, URLs, and notes. You can organize entries into color-coded groups and mark favorites for quick access.',
    color: 'var(--accent)',
  },
  {
    title: 'Security Dashboard',
    subtitle: 'Monitor your vault health',
    icon: <LayoutDashboard size={32} />,
    description: 'The Dashboard gives you a real-time security score, password strength distribution, reuse detection, and risk analysis. Use it to identify weak or compromised credentials.',
    color: 'var(--success)',
  },
  {
    title: 'Decoy Protocol',
    subtitle: 'Plausible deniability',
    icon: <Ghost size={32} />,
    description: 'Set a secondary "ghost" password that opens a decoy vault with realistic dummy accounts. If coerced, you can reveal the ghost password without exposing your real data.',
    color: '#9f7aea',
  },
  {
    title: 'Sovereign Intelligence',
    subtitle: 'Advanced OPSEC analysis',
    icon: <Brain size={32} />,
    description: 'Identity Blast Radius analysis maps your accounts by email/username to show which personas carry the most systemic risk. Ideal for operational security assessment.',
    color: 'var(--accent)',
  },
];

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="modal-overlay onboarding-overlay" onClick={onClose}>
      <motion.div
        className="modal onboarding-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      >
        {/* Progress dots */}
        <div className="onboarding-progress">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`onboarding-dot ${i === step ? 'active' : i < step ? 'done' : ''}`}
            >
              {i < step ? <Check size={10} /> : i + 1}
            </div>
          ))}
          <div className="onboarding-progress-track">
            <div
              className="onboarding-progress-fill"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="onboarding-content"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            <div className="onboarding-icon" style={{ color: current.color, background: `${current.color}15` }}>
              {current.icon}
            </div>
            <h2 className="onboarding-title">{current.title}</h2>
            <p className="onboarding-subtitle">{current.subtitle}</p>
            <p className="onboarding-desc">{current.description}</p>
          </motion.div>
        </AnimatePresence>

        {/* Footer */}
        <div className="onboarding-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Skip Tour
          </button>
          <div className="onboarding-footer-right">
            {step > 0 && (
              <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>
                Back
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={() => isLast ? onClose() : setStep(s => s + 1)}
            >
              {isLast ? 'Get Started' : 'Next'}
              {!isLast && <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingWizard;
