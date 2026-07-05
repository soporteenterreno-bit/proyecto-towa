import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';

interface Question {
  id: string;
  text: string;
  points: number;
}

interface Componente {
  id: string;
  name: string;
  questions: Question[];
}

export default function AdminPreguntas() {
  const [componentes, setComponentes] = useState<Componente[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuestions, setEditQuestions] = useState<Question[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'preguntas_componentes'), 
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Componente));
        setComponentes(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching componentes:", error);
        alert("Error cargando componentes: " + error.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleCreateNew = () => {
    const newId = `comp_${Date.now()}`;
    setEditingId(newId);
    setEditName('');
    setEditQuestions([]);
  };

  const handleEdit = (comp: Componente) => {
    setEditingId(comp.id);
    setEditName(comp.name);
    setEditQuestions(comp.questions || []);
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const addQuestion = () => {
    setEditQuestions([...editQuestions, { id: `q_${Date.now()}`, text: '', points: 0 }]);
  };

  const updateQuestionText = (id: string, text: string) => {
    setEditQuestions(editQuestions.map(q => q.id === id ? { ...q, text } : q));
  };

  const updateQuestionPoints = (id: string, points: number) => {
    setEditQuestions(editQuestions.map(q => q.id === id ? { ...q, points } : q));
  };

  const removeQuestion = (id: string) => {
    setEditQuestions(editQuestions.filter(q => q.id !== id));
  };

  const distributePointsEqually = () => {
    if (editQuestions.length === 0) return;
    const pointsPerQuestion = Math.floor(100 / editQuestions.length);
    let remainder = 100 % editQuestions.length;
    
    setEditQuestions(editQuestions.map((q, index) => {
      let p = pointsPerQuestion;
      if (remainder > 0) {
        p += 1;
        remainder -= 1;
      }
      return { ...q, points: p };
    }));
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      alert("El nombre del componente no puede estar vacío");
      return;
    }
    const totalPoints = editQuestions.reduce((acc, q) => acc + q.points, 0);
    if (totalPoints !== 100 && editQuestions.length > 0) {
       alert(`La suma de los puntos debe ser exactamente 100. Actualmente es: ${totalPoints}`);
       return;
    }

    try {
      await setDoc(doc(db, 'preguntas_componentes', editingId!), {
        name: editName,
        questions: editQuestions
      });
      setEditingId(null);
    } catch (error) {
      console.error(error);
      alert("Error al guardar componente");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Estás seguro de eliminar este componente?")) {
      await deleteDoc(doc(db, 'preguntas_componentes', id));
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administración de Preguntas</h1>
          <p className="text-gray-500 text-sm mt-1">Configura las preguntas a responder por cada tipo de componente.</p>
        </div>
        {!editingId && (
          <button onClick={handleCreateNew} className="flex items-center bg-brand-dark text-white px-4 py-2 rounded-xl font-medium hover:bg-brand-hover">
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Componente
          </button>
        )}
      </div>

      {editingId && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-brand-dark/20 space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <h2 className="text-lg font-bold">Editando Componente</h2>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Componente (ej. PC, Impresora)</label>
            <input 
              type="text" 
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full md:w-1/2 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-brand-dark focus:border-brand-dark"
              placeholder="Ej: Impresora Fiscal"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Preguntas del Componente</h3>
              <div className="space-x-3">
                <button onClick={distributePointsEqually} className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-medium">
                  Distribución Equitativa (100 pts)
                </button>
                <button onClick={addQuestion} className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 font-medium">
                  + Añadir Pregunta
                </button>
              </div>
            </div>

            {editQuestions.length === 0 ? (
              <p className="text-gray-500 text-sm italic border-l-4 border-gray-300 pl-4 py-2">No hay preguntas agregadas. Haz clic en "+ Añadir Pregunta".</p>
            ) : (
              <div className="space-y-3">
                {editQuestions.map((q, i) => (
                  <div key={q.id} className="flex items-start gap-4 p-4 border rounded-xl bg-gray-50">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Pregunta {i+1}</label>
                      <textarea 
                        rows={2}
                        value={q.text}
                        onChange={(e) => updateQuestionText(q.id, e.target.value)}
                        className="w-full border p-2 rounded-lg text-sm"
                        placeholder="Define la actividad a verificar..."
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Puntos</label>
                      <input 
                        type="number"
                        min="0"
                        max="100"
                        value={q.points}
                        onChange={(e) => updateQuestionPoints(q.id, parseInt(e.target.value) || 0)}
                        className="w-full border p-2 rounded-lg text-sm text-center font-bold text-brand-dark"
                      />
                    </div>
                    <div className="pt-6">
                      <button onClick={() => removeQuestion(q.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm font-medium">
                Suma Total: <span className={`font-bold ${editQuestions.reduce((a, b) => a + b.points, 0) === 100 ? 'text-green-600' : 'text-red-500'}`}>
                  {editQuestions.reduce((a, b) => a + b.points, 0)} pts
                </span>
              </div>
              <button onClick={handleSave} className="flex items-center px-6 py-2.5 bg-brand-dark text-white rounded-xl font-bold hover:bg-brand-hover">
                <Save className="w-4 h-4 mr-2" /> Guardar Componente
              </button>
            </div>
          </div>
        </div>
      )}

      {!editingId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {componentes.map(comp => (
            <div key={comp.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-gray-900 truncate pr-2">{comp.name}</h3>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(comp)} className="text-blue-600 bg-blue-50 p-1.5 rounded-lg hover:bg-blue-100">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(comp.id)} className="text-red-600 bg-red-50 p-1.5 rounded-lg hover:bg-red-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">
                <p className="font-medium mb-1">{comp.questions.length} preguntas configuradas</p>
                <div className="text-xs text-gray-400">Total: {comp.questions.reduce((a,b)=>a+b.points,0)} pts</div>
              </div>
            </div>
          ))}
          {componentes.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-2xl border border-dashed border-gray-300">
              No hay componentes registrados aún.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
