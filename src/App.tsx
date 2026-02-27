import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import MergePDF from './pages/MergePDF'
import SplitPDF from './pages/SplitPDF'
import ReorderPDF from './pages/ReorderPDF'
import RotatePDF from './pages/RotatePDF'
import RemovePages from './pages/RemovePages'
import ImagesToPDF from './pages/ImagesToPDF'
import EditMetadata from './pages/ProtectPDF'
import AddPageNumbers from './pages/AddPageNumbers'
import WatermarkPDF from './pages/WatermarkPDF'
import MarkdownToPDF from './pages/MarkdownToPDF'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/merge" element={<MergePDF />} />
        <Route path="/split" element={<SplitPDF />} />
        <Route path="/reorder" element={<ReorderPDF />} />
        <Route path="/rotate" element={<RotatePDF />} />
        <Route path="/remove" element={<RemovePages />} />
        <Route path="/images-to-pdf" element={<ImagesToPDF />} />
        <Route path="/metadata" element={<EditMetadata />} />
        <Route path="/page-numbers" element={<AddPageNumbers />} />
        <Route path="/watermark" element={<WatermarkPDF />} />
        <Route path="/markdown-to-pdf" element={<MarkdownToPDF />} />
      </Routes>
    </Layout>
  )
}
