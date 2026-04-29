import { useEffect, useState } from 'react';
import { Check, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { adminAPI, getApiError } from '../services/api.js';
import { formatDateTime } from '../utils/session.js';

function MasterAdminUsers() {
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState('');
  const [error, setError] = useState('');

  async function loadUsers() {
    try {
      setLoading(true);
      const [usersResponse, pendingResponse] = await Promise.all([
        adminAPI.getUsers(),
        adminAPI.getPendingUsers()
      ]);
      setUsers(usersResponse.data);
      setPendingUsers(pendingResponse.data);
      setError('');
    } catch (err) {
      setError(getApiError(err, 'Failed to load users.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function updateUser(id, action) {
    try {
      setActingId(id);
      if (action === 'approve') {
        await adminAPI.approveUser(id);
      } else {
        await adminAPI.rejectUser(id);
      }
      await loadUsers();
    } catch (err) {
      setError(getApiError(err, 'Failed to update user.'));
    } finally {
      setActingId('');
    }
  }

  const admins = users.filter((user) => user.role === 'ADMIN');

  return (
    <section className="admin-users-section" aria-label="User management">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Master Admin</p>
          <h2>User Approvals</h2>
        </div>
        <button className="button button-secondary compact" type="button" onClick={loadUsers}>
          <RefreshCw size={18} aria-hidden="true" />
          Refresh Users
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="admin-users-grid">
        <div className="panel">
          <div className="panel-heading">
            <span className="section-icon"><ShieldCheck size={18} aria-hidden="true" /></span>
            <h2>Pending Signup Requests</h2>
          </div>
          {loading ? (
            <p className="muted">Loading users...</p>
          ) : pendingUsers.length === 0 ? (
            <p className="muted">No pending signup requests.</p>
          ) : (
            <div className="approval-list">
              {pendingUsers.map((user) => (
                <div className="approval-row" key={user.id}>
                  <div>
                    <strong>{user.username}</strong>
                    <span className="muted block">{formatDateTime(user.createdAt)}</span>
                  </div>
                  <div className="inline-actions">
                    <button
                      className="icon-button success-action"
                      type="button"
                      title="Approve user"
                      onClick={() => updateUser(user.id, 'approve')}
                      disabled={actingId === user.id}
                    >
                      <Check size={18} aria-hidden="true" />
                      <span className="sr-only">Approve</span>
                    </button>
                    <button
                      className="icon-button danger-action"
                      type="button"
                      title="Reject user"
                      onClick={() => updateUser(user.id, 'reject')}
                      disabled={actingId === user.id}
                    >
                      <X size={18} aria-hidden="true" />
                      <span className="sr-only">Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <span className="section-icon"><ShieldCheck size={18} aria-hidden="true" /></span>
            <h2>All Admins</h2>
          </div>
          {loading ? (
            <p className="muted">Loading admins...</p>
          ) : admins.length === 0 ? (
            <p className="muted">No admin users found.</p>
          ) : (
            <div className="compact-table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((user) => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td><span className={`status-badge user-${user.status.toLowerCase()}`}>{user.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default MasterAdminUsers;
