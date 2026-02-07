import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../services/supabaseClient';
import { UserProfile } from '../types';
import { ChevronRight, Search, Zap, Plus, AlertCircle, CheckCircle2, Ban, Trash2, RotateCcw, ShieldPlus, ShieldMinus, Star, LayoutDashboard, Users, TrendingUp } from 'lucide-react';

interface AdminPanelProps {
    currentUser: UserProfile;
    onClose: () => void;
}

interface AdminUserView {
    id: string;
    business_name: string;
    phone?: string;
    app_credits: number;
    last_active: string;
    is_admin: boolean;
    is_super_admin: boolean;
    is_banned: boolean;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, onClose }) => {
    const [users, setUsers] = useState<AdminUserView[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<AdminUserView | null>(null);
    const [creditAmount, setCreditAmount] = useState<number>(100);
    const [processing, setProcessing] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);
    const [view, setView] = useState<'users' | 'dashboard' | 'logs'>('dashboard');
    const [stats, setStats] = useState<any>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Security: Max credit limit
    const MAX_CREDIT_GRANT = 1000000;

    useEffect(() => {
        if (view === 'logs') fetchLogs();
    }, [view]);

    useEffect(() => {
        fetchUsers();
        fetchStats();
    }, []);

    const fetchLogs = async () => {
        try {
            const { data, error } = await supabase.rpc('get_admin_logs');
            if (error) throw error;
            setLogs(data || []);
        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: "Erreur lecture logs: " + (err.message || String(err)) });
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_admin_user_list');
            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error("Failed to fetch users", err);
            // @ts-ignore
            setMessage({ type: 'error', text: "Erreur: " + (err.message || JSON.stringify(err)) });
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
            if (error) throw error;
            // RPC returns an array, take the first item
            if (data && data.length > 0) {
                // Map RPC columns to component state expectations if needed
                // RPC returns: total_users, active_users_24h, total_credits_distributed, blocked_users, active_admins
                // Accessing directly since keys match mostly, but let's be explicit
                setStats({
                    total_users: data[0].total_users,
                    total_credits: data[0].total_credits_distributed, // Map distributed to total
                    total_admins: data[0].active_admins,
                    total_banned: data[0].blocked_users
                });
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleGrantCredits = async () => {
        // Security: Validate input
        if (!selectedUser) {
            setMessage({ type: 'error', text: 'Veuillez sélectionner un utilisateur' });
            return;
        }

        if (creditAmount <= 0) {
            setMessage({ type: 'error', text: 'Le montant doit être supérieur à 0' });
            return;
        }

        if (creditAmount > MAX_CREDIT_GRANT) {
            setMessage({ type: 'error', text: `Le montant ne peut pas dépasser ${MAX_CREDIT_GRANT.toLocaleString()} crédits` });
            return;
        }

        setProcessing(true);
        setMessage(null);

        try {
            const { data, error } = await supabase.rpc('grant_credits', {
                target_user_id: selectedUser.id,
                amount: creditAmount
            });

            if (error) throw error;

            setMessage({ type: 'success', text: `${creditAmount.toLocaleString()} crédits ajoutés à ${selectedUser.business_name || 'utilisateur'}` });
            setCreditAmount(100);
            setSelectedUser(null);
            fetchUsers(); // Refresh list
            fetchStats(); // Update dashboard stats
        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: err.message || "Erreur lors de l'ajout des crédits." });
        } finally {
            setProcessing(false);
        }
    };


    const handleBanUser = async (user: AdminUserView) => {
        const action = user.is_banned ? "débloquer" : "bloquer";
        if (!confirm(`Voulez-vous vraiment ${action} ${user.business_name || 'cet utilisateur'} ?`)) return;

        try {
            const { error } = await supabase.rpc('toggle_user_ban', { target_user_id: user.id });
            if (error) throw error;

            setMessage({ type: 'success', text: `Utilisateur ${user.is_banned ? 'débloqué' : 'bloqué'} avec succès.` });
            fetchUsers();
        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: err.message || "Erreur lors de l'action." });
        }
    };

    const handleDeleteUser = async (user: AdminUserView) => {
        if (!confirm(`DANGER: Voulez-vous vraiment SUPPRIMER TOUTES LES DONNÉES de ${user.business_name || 'cet utilisateur'} ?\n\nCette action est IRRÉVERSIBLE.`)) return;

        const confirmName = prompt(`Pour confirmer, tapez "SUPPRIMER" :`);
        if (confirmName !== "SUPPRIMER") return;

        try {
            const { error } = await supabase.rpc('delete_user_data', { target_user_id: user.id });
            if (error) throw error;

            setMessage({ type: 'success', text: "Données de l'utilisateur supprimées définivement." });
            if (selectedUser?.id === user.id) setSelectedUser(null);
            fetchUsers();
        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: err.message || "Erreur lors de la suppression." });
        }
    };

    const handleToggleAdminRole = async (user: AdminUserView) => {
        const action = user.is_admin ? "retirer les droits d'admin" : "nommer ADMIN (Sous-Admin)";
        if (!confirm(`SUPER ADMIN : Voulez-vous vraiment ${action} à ${user.business_name || 'cet utilisateur'} ?`)) return;

        try {
            const { error } = await supabase.rpc('toggle_admin_role', { target_user_id: user.id });
            if (error) throw error;

            setMessage({ type: 'success', text: `Rôle mis à jour avec succès.` });
            fetchUsers();
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: "Erreur lors du changement de rôle." });
        }
    };

    const filteredUsers = users.filter(u => {
        const term = searchTerm.toLowerCase().trim();
        const phoneTerm = term.replace(/\s+/g, ''); // Allow searching "7000" matching "70 00 ..."

        const nameMatch = (u.business_name || 'Sans Nom').toLowerCase().includes(term);
        const idMatch = u.id.toLowerCase().includes(term);

        const userPhoneClean = (u.phone || '').replace(/\s+/g, '');
        const phoneMatch = userPhoneClean.includes(phoneTerm);

        return nameMatch || idMatch || phoneMatch;
    });

    // Use createPortal to break out of any parent stacking context (z-index traps)
    return createPortal(
        <div className="fixed inset-0 z-[99999] bg-gray-50 flex flex-col h-full w-full overflow-hidden">
            {/* HEADER */}
            <div className="bg-slate-900 border-b border-slate-700 px-4 py-4 flex items-center justify-between sticky top-0 z-20 shadow-xl">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-white transition-colors">
                        <ChevronRight className="rotate-180" />
                    </button>
                    <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-wide">
                        <Zap className="text-amber-400 fill-current" />
                        Panel Admin
                    </h2>
                </div>
            </div>

            <div className="bg-gray-100 p-2 flex gap-2 overflow-x-auto">
                <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${view === 'dashboard' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}><LayoutDashboard size={16} /> Dashboard</button>
                <button onClick={() => setView('users')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${view === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}><Users size={16} /> Utilisateurs</button>
                <button onClick={() => setView('logs')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${view === 'logs' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}><AlertCircle size={16} /> Logs Séc.</button>
            </div>

            <div className="flex-1 overflow-auto p-4 max-w-4xl mx-auto w-full pb-20">
                {view === 'dashboard' && (
                    <div className="animate-in fade-in duration-300 space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="text-gray-400 text-xs font-bold uppercase mb-1">Total Utilisateurs</div>
                                <div className="text-2xl font-black text-gray-900">{stats?.total_users || 0}</div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="text-gray-400 text-xs font-bold uppercase mb-1">Crédits en Circulation</div>
                                <div className="text-2xl font-black text-blue-600">{new Intl.NumberFormat().format(stats?.total_credits || 0)}</div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="text-gray-400 text-xs font-bold uppercase mb-1">Admins Actifs</div>
                                <div className="text-2xl font-black text-purple-600">{stats?.total_admins || 0}</div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="text-gray-400 text-xs font-bold uppercase mb-1">Comptes Bloqués</div>
                                <div className="text-2xl font-black text-red-600">{stats?.total_banned || 0}</div>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'users' && (
                    /* Existing User View Code (truncated for brevity in diff, but will be preserved) */
                    <>
                        {/* ACTION AREA - Only show when managing users */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Gestion des Crédits</h3>

                            {message && (
                                <div className={`p-4 rounded-xl mb-4 flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                                    {message.text}
                                </div>
                            )}

                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-500 mb-1">Utilisateur Cible</label>
                                    {selectedUser ? (
                                        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                            <div>
                                                <div className="font-bold text-blue-900">{selectedUser.business_name || 'Utilisateur sans nom'}</div>
                                                <div className="text-xs text-blue-600">ID: {selectedUser.id.substring(0, 8)}...</div>
                                            </div>
                                            <button onClick={() => setSelectedUser(null)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Changer</button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Nom, Téléphone ou ID..."
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="w-full md:w-48">
                                    <label className="block text-sm font-medium text-gray-500 mb-1">Montant à Ajouter</label>
                                    <input
                                        type="number"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono"
                                        value={creditAmount}
                                        onChange={e => {
                                            const val = parseInt(e.target.value) || 0;
                                            setCreditAmount(Math.max(0, Math.min(val, MAX_CREDIT_GRANT)));
                                        }}
                                        min="1"
                                        max={MAX_CREDIT_GRANT}
                                        step="1"
                                    />
                                    <div className="text-xs text-gray-400 mt-1">Max: {MAX_CREDIT_GRANT.toLocaleString()}</div>
                                </div>

                                <div className="flex items-end">
                                    <button
                                        onClick={handleGrantCredits}
                                        disabled={!selectedUser || processing || creditAmount <= 0}
                                        className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                                    >
                                        {processing ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Plus size={20} />}
                                        Créditer
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* USER LIST */}
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 px-1">Utilisateurs ({loading ? '...' : filteredUsers.length})</h3>

                        {loading ? (
                            <div className="p-8 text-center text-gray-400">Chargement...</div>
                        ) : (
                            <div className="grid gap-3">
                                {filteredUsers.map(user => (
                                    <div
                                        key={user.id}
                                        className={`group p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-300 cursor-pointer transition-all ${selectedUser?.id === user.id ? 'ring-2 ring-blue-500 border-transparent' : ''}`}
                                        onClick={() => setSelectedUser(user)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${user.is_banned ? 'bg-red-500' : (user.is_super_admin ? 'bg-amber-500' : (user.is_admin ? 'bg-purple-600' : 'bg-gray-400'))}`}>
                                                    {user.is_banned ? <Ban size={18} /> : (user.is_super_admin ? <Star size={18} fill="white" /> : (user.business_name?.[0]?.toUpperCase() || '?'))}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 flex items-center gap-2">
                                                        {(user.business_name && user.business_name.trim() !== '' && user.business_name !== 'Ma Nouvelle Boutique')
                                                            ? user.business_name
                                                            : `Utilisateur ${user.id.substring(0, 6)}`}

                                                        {user.is_super_admin && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Star size={8} fill="currentColor" /> SUPER ADMIN</span>}
                                                        {!user.is_super_admin && user.is_admin && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">ADMIN</span>}
                                                        {user.is_banned && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">BLOQUÉ</span>}
                                                    </div>
                                                    <div className="text-xs text-gray-500 font-mono flex items-center gap-2">
                                                        {user.phone ? (
                                                            <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{user.phone}</span>
                                                        ) : (
                                                            <span className="text-gray-400">Aucun téléphone</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="text-right">
                                                    <div className="font-bold text-lg text-blue-600">{user.app_credits}</div>
                                                    <div className="text-xs text-gray-400">crédits</div>
                                                </div>

                                                <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleBanUser(user); }}
                                                        className={`p-2 rounded-lg ${user.is_banned ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600'}`}
                                                        title={user.is_banned ? "Débloquer" : "Bloquer"}
                                                    >
                                                        {user.is_banned ? <RotateCcw size={16} /> : <Ban size={16} />}
                                                    </button>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteUser(user); }}
                                                        className="p-2 bg-red-50 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
                                                        title="Supprimer définitivement"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>

                                                    {currentUser.is_super_admin && !user.is_super_admin && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleToggleAdminRole(user); }}
                                                            className={`p-2 rounded-lg ${user.is_admin ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400 hover:bg-purple-100 hover:text-purple-600'}`}
                                                            title={user.is_admin ? "Rétrograder en simple utilisateur" : "Promouvoir ADMIN"}
                                                        >
                                                            {user.is_admin ? <ShieldMinus size={16} /> : <ShieldPlus size={16} />}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {filteredUsers.length === 0 && (
                                    <div className="p-8 text-center bg-gray-50 rounded-xl text-gray-500">
                                        Aucun utilisateur trouvé.
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {view === 'logs' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2"><AlertCircle size={18} /> Logs de Sécurité (Derniers 100)</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {logs.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">Aucune activité enregistrée.</div>
                            ) : (
                                logs.map((log: any) => (
                                    <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${log.action === 'DELETE_USER' ? 'bg-red-100 text-red-700' :
                                                log.action === 'GRANT_CREDIT' ? 'bg-green-100 text-green-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                {log.action}
                                            </span>
                                            <span className="text-xs text-gray-400 font-mono">{new Date(log.created_at).toLocaleString()}</span>
                                        </div>
                                        <div className="mt-2 space-y-1">
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-gray-400 text-xs uppercase w-12">Admin:</span>
                                                <span className="font-bold text-gray-900">{log.admin_business_name}</span>
                                                {log.admin_phone && <span className="text-xs text-gray-500 bg-gray-100 px-1.5 rounded font-mono">{log.admin_phone}</span>}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-gray-400 text-xs uppercase w-12">Cible:</span>
                                                <span className="font-bold text-gray-900">{log.target_business_name}</span>
                                                {log.target_phone && <span className="text-xs text-blue-600 bg-blue-50 px-1.5 rounded font-mono">{log.target_phone}</span>}
                                            </div>
                                        </div>

                                        <div className="mt-2 bg-gray-50 p-2 rounded-lg text-xs text-gray-700 border border-gray-200">
                                            {log.action === 'GRANT_CREDIT' && (
                                                <span className="font-bold text-green-700">
                                                    +{log.details?.amount?.toLocaleString()} Crédits ajoutés
                                                </span>
                                            )}
                                            {(log.action === 'BAN_USER' || log.action === 'UNBAN_USER') && (
                                                <span className={`font-bold ${log.details?.new_status ? 'text-red-600' : 'text-green-600'}`}>
                                                    Statut: {log.details?.new_status ? 'BLOQUÉ' : 'DÉBLOQUÉ'}
                                                </span>
                                            )}
                                            {log.action === 'DELETE_USER' && (
                                                <span className="font-bold text-red-700">
                                                    Raison: {log.details?.reason || 'Suppression Manuelle'}
                                                </span>
                                            )}
                                            {log.action === 'PROMOTE_ADMIN' && (
                                                <span className="font-bold text-purple-700">
                                                    Promu ADMIN
                                                </span>
                                            )}
                                            {/* Fallback for other details */}
                                            {(!['GRANT_CREDIT', 'BAN_USER', 'UNBAN_USER', 'DELETE_USER', 'PROMOTE_ADMIN'].includes(log.action)) && (
                                                <span className="font-mono text-gray-500">{JSON.stringify(log.details)}</span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div >,
        document.body
    );
};

export default AdminPanel;
