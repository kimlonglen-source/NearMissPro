import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

interface Option {
  id: string;
  label: string;
  group_name: string | null;
  category: string;
}

type DispensaryStage = 'data_entry' | 'dispensing' | 'labelling';

const STAGES: { value: DispensaryStage; label: string }[] = [
  { value: 'data_entry', label: 'Data Entry' },
  { value: 'dispensing', label: 'Dispensing' },
  { value: 'labelling', label: 'Labelling' },
];

const DETECTION_POINTS = [
  { value: 'data_entry_check', label: 'During data entry' },
  { value: 'dispensing_check', label: 'During dispensing' },
  { value: 'labelling_check', label: 'During labelling' },
  { value: 'final_check', label: 'At final check' },
  { value: 'patient_counselling', label: 'At patient counselling' },
  { value: 'after_collection', label: 'After collection' },
];

const TIMES = [
  { value: 'morning', label: 'Morning (open\u201312pm)' },
  { value: 'midday', label: 'Midday (12\u20132pm)' },
  { value: 'afternoon', label: 'Afternoon (2\u20135pm)' },
  { value: 'evening', label: 'Evening (5pm\u2013close)' },
];

const SWAP_TRIGGERS = {
  wrong_drug: { color: 'coral', prescribed: 'prescribedDrug', dispensed: 'dispensedDrug' },
  wrong_dose: { color: 'amber', prescribed: 'prescribedStrength', dispensed: 'dispensedStrength' },
  wrong_formulation: { color: 'purple', prescribed: 'prescribedFormulation', dispensed: 'dispensedFormulation' },
} as const;

function labelToErrorType(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('wrong drug') || lower.includes('wrong drug picked')) return 'wrong_drug';
  if (lower.includes('wrong strength') || lower.includes('wrong dose')) return 'wrong_dose';
  if (lower.includes('wrong formulation')) return 'wrong_formulation';
  if (lower.includes('wrong patient')) return 'wrong_patient';
  if (lower.includes('wrong quantity')) return 'wrong_quantity';
  if (lower.includes('wrong label') || lower.includes('label')) return 'wrong_label';
  if (lower.includes('wrong direction') || lower.includes('directions')) return 'wrong_directions';
  if (lower.includes('omission') || lower.includes('missed')) return 'omission';
  return 'other';
}

export function RecordPage() {
  const [step, setStep] = useState(1);
  const [options, setOptions] = useState<Record<string, Record<string, Option[]>>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [dispensaryStage, setDispensaryStage] = useState<DispensaryStage | ''>('');
  const [selectedErrors, setSelectedErrors] = useState<string[]>([]);
  const [swapData, setSwapData] = useState<Record<string, string>>({});
  const [detectionPoint, setDetectionPoint] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('');
  const [selectedFactors, setSelectedFactors] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    api.getOptions()
      .then((data) => setOptions(data as Record<string, Record<string, Option[]>>))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const activeErrorTypes = selectedErrors.map((id) => {
    const allOpts = Object.values(options.error_type || {}).flat();
    const opt = allOpts.find((o) => o.id === id);
    return opt ? labelToErrorType(opt.label) : '';
  });

  const activeSwaps = Object.keys(SWAP_TRIGGERS).filter((t) => activeErrorTypes.includes(t));

  const section1Valid = dispensaryStage !== '' && selectedErrors.length > 0;
  const section2Valid = detectionPoint !== '' && timeOfDay !== '';
  const section3Valid = selectedFactors.length > 0;
  const canSubmit = section1Valid && section2Valid && section3Valid;

  const toggleChip = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');

    try {
      const errorTypeValues = [...new Set(activeErrorTypes.filter(Boolean))];

      await api.createIncident({
        dispensaryStage,
        errorTypes: errorTypeValues.length > 0 ? errorTypeValues : ['other'],
        detectionPoint,
        timeOfDay,
        contributingFactors: selectedFactors,
        notes: notes || undefined,
        prescribedDrug: swapData.prescribedDrug || undefined,
        dispensedDrug: swapData.dispensedDrug || undefined,
        prescribedStrength: swapData.prescribedStrength || undefined,
        dispensedStrength: swapData.dispensedStrength || undefined,
        prescribedFormulation: swapData.prescribedFormulation || undefined,
        dispensedFormulation: swapData.dispensedFormulation || undefined,
      });

      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-teal" size={32} />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle2 size={40} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Near miss recorded</h2>
        <p className="text-gray-500 mb-6">Thank you \u2014 this helps keep patients safe.</p>
        <button onClick={() => {
          setSubmitted(false);
          setStep(1);
          setDispensaryStage('');
          setSelectedErrors([]);
          setSwapData({});
          setDetectionPoint('');
          setTimeOfDay('');
          setSelectedFactors([]);
          setNotes('');
        }} className="btn-primary">
          Record another
        </button>
      </div>
    );
  }

  const errorOptions = options.error_type || {};
  const factorOptions = options.contributing_factor || {};

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                ${step === s ? 'bg-brand-teal text-white' : step > s ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}
            >
              {step > s ? '\u2713' : s}
            </div>
            {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-green-300' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">What went wrong?</h2>
            <p className="text-sm text-gray-500">Select the stage and error type(s)</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Dispensary stage</label>
            <div className="flex gap-2">
              {STAGES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => { setDispensaryStage(value); setSelectedErrors([]); }}
                  className={`chip flex-1 text-center ${dispensaryStage === value ? 'chip-selected' : 'chip-unselected'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {dispensaryStage && (
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">What happened?</label>
              {Object.entries(errorOptions)
                .filter(([group]) => {
                  const stageMap: Record<string, string> = {
                    data_entry: 'Data entry',
                    dispensing: 'Dispensing',
                    labelling: 'Labelling',
                  };
                  return group === stageMap[dispensaryStage];
                })
                .map(([group, opts]) => (
                  <div key={group} className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {opts.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => toggleChip(opt.id, selectedErrors, setSelectedErrors)}
                          className={`chip ${selectedErrors.includes(opt.id) ? 'chip-selected' : 'chip-unselected'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {activeSwaps.map((swapType) => {
            const config = SWAP_TRIGGERS[swapType as keyof typeof SWAP_TRIGGERS];
            const colorMap = {
              coral: { bg: 'bg-swap-coral-bg', border: 'border-swap-coral', text: 'text-swap-coral' },
              amber: { bg: 'bg-swap-amber-bg', border: 'border-swap-amber', text: 'text-swap-amber' },
              purple: { bg: 'bg-swap-purple-bg', border: 'border-swap-purple', text: 'text-swap-purple' },
            };
            const colors = colorMap[config.color];
            const labels = {
              wrong_drug: { prescribed: 'Prescribed drug', dispensed: 'Dispensed in error' },
              wrong_dose: { prescribed: 'Prescribed strength', dispensed: 'Strength picked' },
              wrong_formulation: { prescribed: 'Prescribed formulation', dispensed: 'Formulation picked' },
            };
            const lab = labels[swapType as keyof typeof labels];

            return (
              <div key={swapType} className={`${colors.bg} border-2 ${colors.border} rounded-2xl p-4 space-y-3`}>
                <h3 className={`font-semibold ${colors.text} text-sm`}>
                  {swapType === 'wrong_drug' ? 'Drug swap' : swapType === 'wrong_dose' ? 'Strength swap' : 'Formulation swap'}
                </h3>
                <input
                  type="text"
                  placeholder={lab.prescribed}
                  value={swapData[config.prescribed] || ''}
                  onChange={(e) => setSwapData({ ...swapData, [config.prescribed]: e.target.value })}
                  className="input-field"
                />
                <div className="text-center text-gray-400 text-xs">\u2195</div>
                <input
                  type="text"
                  placeholder={lab.dispensed}
                  value={swapData[config.dispensed] || ''}
                  onChange={(e) => setSwapData({ ...swapData, [config.dispensed]: e.target.value })}
                  className="input-field"
                />
              </div>
            );
          })}

          <button
            onClick={() => setStep(2)}
            disabled={!section1Valid}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Next <ArrowRight size={18} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Where was it caught?</h2>
            <p className="text-sm text-gray-500">Select when the near miss was detected</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Detection point</label>
            <div className="space-y-2">
              {DETECTION_POINTS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDetectionPoint(value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all
                    ${detectionPoint === value
                      ? 'border-brand-teal bg-brand-teal/5 text-brand-teal font-medium'
                      : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Time of day</label>
            <div className="grid grid-cols-2 gap-2">
              {TIMES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTimeOfDay(value)}
                  className={`chip text-center ${timeOfDay === value ? 'chip-selected' : 'chip-unselected'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1 flex items-center justify-center gap-2">
              <ArrowLeft size={18} /> Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!section2Valid}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              Next <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">What contributed?</h2>
            <p className="text-sm text-gray-500">Select all contributing factors</p>
          </div>

          {Object.entries(factorOptions).map(([group, opts]) => (
            <div key={group}>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">{group}</label>
              <div className="flex flex-wrap gap-2">
                {opts.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => toggleChip(opt.id, selectedFactors, setSelectedFactors)}
                    className={`chip ${selectedFactors.includes(opt.id) ? 'chip-selected' : 'chip-unselected'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Additional notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any extra details..."
              rows={3}
              className="input-field resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary flex-1 flex items-center justify-center gap-2">
              <ArrowLeft size={18} /> Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
