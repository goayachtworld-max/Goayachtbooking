import { DemandModel } from "../models/demand.model.js";

export const createDemand = async (req, res, next) => {
    try {
        const {
            customerName,
            customerId,
            agentName,
            agentId,
            yachtName,
            yachtId,
            date,
            time,
            notes,
        } = req.body;

        const companyId = req.user.company[0];

        const demand = await DemandModel.create({
            customerName:  customerName  || null,
            customerId:    customerId    || null,
            agentName:     agentName     || null,
            agentId:       agentId       || null,
            yachtName:     yachtName     || null,
            yachtId:       yachtId       || null,
            date,
            time,
            notes:         notes         || null,
            company:       companyId,
            createdBy:     req.user.id,
        });

        res.status(201).json({ success: true, demand });
    } catch (error) {
        next(error);
    }
};

export const getDemands = async (req, res, next) => {
    try {
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip  = (page - 1) * limit;

        const filter = { company: { $in: req.user.company } };

        if (req.query.status) filter.status = req.query.status;

        // Yacht filter
        if (req.query.yachtId) filter.yachtId = req.query.yachtId;

        // Date range filter (?from=YYYY-MM-DD&to=YYYY-MM-DD)
        if (req.query.from || req.query.to) {
            filter.date = {};
            if (req.query.from) filter.date.$gte = new Date(req.query.from);
            if (req.query.to)   filter.date.$lte = new Date(req.query.to);
        }

        // Month filter (?month=YYYY-MM) — overrides from/to if both provided
        if (req.query.month) {
            const [y, m] = req.query.month.split('-').map(Number);
            const start  = new Date(y, m - 1, 1);
            const end    = new Date(y, m, 1);
            filter.date  = { $gte: start, $lt: end };
        }

        const [demands, total] = await Promise.all([
            DemandModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('customerId',  'name contact email')
                .populate('agentId',     'name contact')
                .populate('yachtId',     'name')
                .populate('createdBy',   'name'),
            DemandModel.countDocuments(filter),
        ]);

        res.json({
            success: true,
            demands,
            total,
            totalPages:  Math.ceil(total / limit),
            currentPage: page,
        });
    } catch (error) {
        next(error);
    }
};

export const getDemandById = async (req, res, next) => {
    try {
        const demand = await DemandModel.findOne({
            _id:     req.params.id,
            company: { $in: req.user.company },
        })
            .populate('customerId', 'name contact email')
            .populate('agentId',   'name contact')
            .populate('yachtId',   'name')
            .populate('createdBy', 'name');

        if (!demand) {
            return res.status(404).json({ success: false, message: 'Demand not found' });
        }

        res.json({ success: true, demand });
    } catch (error) {
        next(error);
    }
};

export const updateDemandStatus = async (req, res, next) => {
    try {
        const { status } = req.body;

        const demand = await DemandModel.findOneAndUpdate(
            { _id: req.params.id, company: { $in: req.user.company } },
            { status },
            { new: true }
        );

        if (!demand) {
            return res.status(404).json({ success: false, message: 'Demand not found' });
        }

        res.json({ success: true, demand });
    } catch (error) {
        next(error);
    }
};

export const deleteDemand = async (req, res, next) => {
    try {
        const demand = await DemandModel.findOneAndDelete({
            _id:     req.params.id,
            company: { $in: req.user.company },
        });

        if (!demand) {
            return res.status(404).json({ success: false, message: 'Demand not found' });
        }

        res.json({ success: true, message: 'Demand deleted' });
    } catch (error) {
        next(error);
    }
};