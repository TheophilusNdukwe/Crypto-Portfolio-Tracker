function deleteTransaction(id) {
    fetch(`/delete-transaction/${id}`, {
        method: 'DELETE',
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Reload the page to reflect changes
            window.location.reload();
        }
    })
    .catch(error => console.error('Error:', error));
}
