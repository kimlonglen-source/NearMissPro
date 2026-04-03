import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

const createIncidentSchema = z.object({
  dispensaryStage: z.enum(['data_entry', 'dispensing', 'labelling']),
  errorTypes: z.array(z.string()).min(1, 'At least one error type is required'),
  prescribedDrug: z.string().optional(),
  dispensedDrug: z.string().optional(),
  prescribedStrength: z.string().optional(),
  dispensedStrength: z.string().optional(),
  prescribedFormulation: z.string().optional(),
  dispensedFormulation: z.string().optional(),
  detectionPoint: z.enum([
    'data_entry_check', 'dispensing_check', 'labelling_check',
    'final_check', 'patient_counselling', 'after_collection', 'other',
  ]),
  timeOfDay: z.enum(['morning', 'midday', 'afternoon', 'evening']),
  contributingFactors: z.array(z.string()).min(1, 'At least one contributing factor is required'),
  notes: z.string().optional(),
  otherEntries: z.array(z.object({
    fieldName: z.string(),
    value: z.string(),
  })).optional(),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createIncidentSchema.parse(req.body);
    const pharmacyId = req.auth!.pharmacyId;

    if (pharmacyId === 'all') {
      res.status(400).json({ error: 'Founder cannot submit incidents directly' });
      return;
    }

    const { data: incident, error } = await supabase
      .from('incidents')
      .insert({
        pharmacy_id: pharmacyId,
        dispensary_stage: data.dispensaryStage,
        error_types: data.errorTypes,
        prescribed_drug: data.prescribedDrug,
        dispensed_drug: data.dispensedDrug,
        prescribed_strength: data.prescribedStrength,
        dispensed_strength: data.dispensedStrength,
        prescribed_formulation: data.prescribedFormulation,
        dispensed_formulation: data.dispensedFormulation,
        detection_point: data.detectionPoint,
        time_of_day: data.timeOfDay,
        contributing_factors: data.contributingFactors,
        notes: data.notes,
        reported_by: req.auth!.role === 'manager' ? 'Manager' : 'Staff',
      })
      .select()
      .single();

    if (error) throw error;

    if (data.otherEntries?.length && incident) {
      const otherRows = data.otherEntries.map((entry) => ({
        incident_id: incident.id,
        field_name: entry.fieldName,
        value: entry.value,
      }));

      await supabase.from('other_entries').insert(otherRows);
    }

    res.status(201).json(incident);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    console.error('Create incident error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { pharmacyId, role } = req.auth!;
    const { status, from, to, page = '1', limit = '20' } = req.query;

    let query = supabase
      .from('incidents')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (role !== 'founder') {
      query = query.eq('pharmacy_id', pharmacyId);
    }

    if (status && typeof status === 'string') {
      query = query.eq('status', status);
    }
    if (from && typeof from === 'string') {
      query = query.gte('created_at', from);
    }
    if (to && typeof to === 'string') {
      query = query.lte('created_at', to);
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;
    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      incidents: data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        pages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (err) {
    console.error('List incidents error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { pharmacyId, role } = req.auth!;

    let query = supabase
      .from('incidents')
      .select('*, other_entries(*), recommendations(*)')
      .eq('id', req.params.id);

    if (role !== 'founder') {
      query = query.eq('pharmacy_id', pharmacyId);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }

    res.json(data);
  } catch (err) {
    console.error('Get incident error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const updateStatusSchema = z.object({
  status: z.enum(['submitted', 'reviewed', 'archived']),
});

router.patch(
  '/:id/status',
  requireRole('manager', 'founder'),
  async (req: Request, res: Response) => {
    try {
      const { status } = updateStatusSchema.parse(req.body);
      const { pharmacyId, role, userId } = req.auth!;

      let query = supabase
        .from('incidents')
        .update({
          status,
          reviewed_by: userId || null,
          reviewed_at: status === 'reviewed' ? new Date().toISOString() : null,
        })
        .eq('id', req.params.id);

      if (role !== 'founder') {
        query = query.eq('pharmacy_id', pharmacyId);
      }

      const { data, error } = await query.select().single();

      if (error) throw error;

      res.json(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid input', details: err.errors });
        return;
      }
      console.error('Update incident error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
