class EventProcessor:
    """Background event processor"""
    
    def __init__(self):
        self.queue = []
    
    def process_event(self, event):
        """Process event"""
        self.queue.append(event)
        return True
    
    def flush_queue(self):
        """Flush queue"""
        count = len(self.queue)
        self.queue = []
        return count
