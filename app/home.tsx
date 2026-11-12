type Props = { bankSize: number; busy: boolean; start: () => void };
export default function Home({ bankSize, busy, start }: Props) {
  return <section className="home-simple" aria-labelledby="home-title">
    <p className="eyebrow">LÝ – DƯỢC</p>
    <h1 id="home-title">Học một chút,<br /><em>hiểu thêm một chút.</em></h1>
    <p className="home-simple-copy">Luyện vài câu theo nhịp của bạn. Không giới hạn thời gian.</p>
    <button className="button primary" onClick={start} disabled={busy || bankSize < 30}>
      {busy ? 'Đang chuẩn bị…' : 'Bắt đầu luyện'} <span aria-hidden="true">→</span>
    </button>
    <p className="home-simple-count">{bankSize ? `${bankSize} câu trong ngân hàng` : 'Đang tải câu hỏi…'} · Mỗi lượt 30 câu ngẫu nhiên</p>
  </section>;
}
