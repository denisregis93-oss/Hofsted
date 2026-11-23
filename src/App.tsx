import { HashRouter, Route, Routes, useParams } from "react-router-dom";
import Pesquisa from "./pages/participante/Pesquisa";
import Entrar from "./pages/participante/Entrar";
import MeuRelatorio from "./pages/participante/MeuRelatorio";
import AdminLayout from "./pages/admin/AdminLayout";
import Pesquisas from "./pages/admin/Pesquisas";
import Funcionarios from "./pages/admin/Funcionarios";
import PesquisaDetalhe from "./pages/admin/PesquisaDetalhe";
import Evolucao from "./pages/admin/Evolucao";
import Metodologia from "./pages/admin/Metodologia";

/** Remonta a tela quando o código da pesquisa muda (evita reaproveitar o estado de outra pesquisa). */
function PesquisaPorCodigo() {
  const { codigo } = useParams();
  return <Pesquisa key={codigo} />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Entrar />} />
        <Route path="/p/:codigo" element={<PesquisaPorCodigo />} />
        <Route path="/p/:codigo/meu-relatorio" element={<MeuRelatorio />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Pesquisas />} />
          <Route path="funcionarios" element={<Funcionarios />} />
          <Route path="pesquisa/:id" element={<PesquisaDetalhe />} />
          <Route path="evolucao" element={<Evolucao />} />
          <Route path="metodologia" element={<Metodologia />} />
        </Route>
        <Route path="*" element={<Entrar />} />
      </Routes>
    </HashRouter>
  );
}
